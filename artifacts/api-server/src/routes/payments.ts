import { Router, type Request, type Response } from "express";
import { db, paymentInvoicesTable, webhookEventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getSetting, getSecretSettings } from "../lib/settings";
import { auditLog } from "../lib/audit";
import { logger } from "../lib/logger";
import {
  createInvoice as npCreateInvoice,
  getInvoice as npGetInvoice,
  verifyIpnSignature as npVerifyIpn,
  mapNowPaymentsStatus as npMapStatus,
  isPayoutEvent as npIsPayoutEvent,
  NOWPAYMENTS_POPULAR_CURRENCIES,
} from "../lib/nowpayments";
import {
  createPixPayment as mpCreatePix,
  getPayment as mpGetPayment,
  verifyWebhookSignature as mpVerifyWebhook,
  mapMercadoPagoStatus as mpMapStatus,
} from "../lib/mercadopago";
import { processConfirmedInvoice, processPayoutWebhook, triggerAutoPayout } from "../lib/split-engine";

const router = Router();

// Converte timestamp do NowPayments (segundos ou ms) para Date de forma segura.
// NowPayments às vezes retorna null, string, ou segundos/ms — normaliza e valida.
function safeDate(ts: any): Date | null {
  if (!ts) return null;
  let n = Number(ts);
  if (isNaN(n)) return null;
  // Se for em segundos (< 10^11), converter para ms
  if (n < 1e11) n = n * 1000;
  const d = new Date(n);
  return isNaN(d.getTime()) ? null : d;
}

// ─── GET /payments/config — what gateways are available ───────────────────────
router.get("/config", requireAuth, async (req: AuthRequest, res) => {
  try {
    const settings = await getSecretSettings();
    const npEnabled = settings.nowpaymentsEnabled === "true" && Boolean(settings.nowpaymentsApiKey);
    const mpEnabled = settings.mercadopagoEnabled === "true" && Boolean(settings.mercadopagoAccessToken);
    // Buscar moedas disponíveis dinamicamente (só as que o merchant liberou na conta)
    let currencies: { code: string; label: string; network?: string }[] = [];
    if (npEnabled) {
      const { getAvailableCurrencies } = await import("../lib/nowpayments");
      currencies = await getAvailableCurrencies();
    }
    res.json({
      nowpayments: {
        enabled: npEnabled,
        priceCurrency: settings.nowpaymentsPriceCurrency || "BRL",
        currencies,
      },
      mercadopago: {
        enabled: mpEnabled,
        methods: mpEnabled ? [{ code: "pix", label: "PIX (QR Code dinâmico)" }] : [],
      },
      minDeposit: Number(await getSetting("minDeposit")) || 10,
    });
  } catch (err) {
    req.log.error({ err }, "Get payments config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /payments/create — create an invoice ───────────────────────────────
router.post("/create", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { provider, payCurrency, amount } = req.body as {
      provider: "nowpayments" | "mercadopago";
      payCurrency?: string;
      amount: number;
    };

    if (!provider || !amount || amount <= 0) {
      res.status(400).json({ error: "provider and amount are required" });
      return;
    }
    const minDeposit = Number(await getSetting("minDeposit")) || 10;
    if (amount < minDeposit) {
      res.status(400).json({ error: `Valor mínimo: R$ ${minDeposit}` });
      return;
    }

    const settings = await getSecretSettings();
    const priceCurrency = settings.nowpaymentsPriceCurrency || "BRL";
    const orderId = `INV-${Date.now()}-${req.userId}`;

    // Create the local invoice row first (status pending)
    const [invoice] = await db.insert(paymentInvoicesTable).values({
      userId: req.userId!,
      provider,
      amountRequested: String(amount),
      priceCurrency,
      payCurrency: payCurrency || null,
      status: "pending",
      metadata: { requestedBy: req.userId, createdAt: new Date().toISOString() },
    }).returning();

    try {
      if (provider === "nowpayments") {
        if (settings.nowpaymentsEnabled !== "true" || !settings.nowpaymentsApiKey) {
          res.status(400).json({ error: "NowPayments não está habilitado" });
          return;
        }
        if (!payCurrency) {
          res.status(400).json({ error: "Moeda de pagamento é obrigatória para NowPayments (escolha uma na tela de depósito)" });
          return;
        }
        // createPayment (não invoice) → retorna endereço de carteira + valor direto
        // para exibir QR code + endereço na própria tela (sem redirect para hosted page)
        const { createPayment: npCreatePayment } = await import("../lib/nowpayments");
        const npPayment = await npCreatePayment({
          priceAmount: amount,
          priceCurrency,
          payCurrency,
          orderId,
          orderDescription: `Depósito InvestFlow — usuário #${req.userId}`,
        });
        await db.update(paymentInvoicesTable).set({
          providerInvoiceId: String(npPayment.payment_id),
          providerStatus: npPayment.payment_status,
          payCurrency: npPayment.pay_currency,
          payAddress: npPayment.pay_address,
          payAmount: String(npPayment.pay_amount),
          expiresAt: npPayment.expiration_estimate_date ? safeDate(npPayment.expiration_estimate_date) : null,
          metadata: npPayment,
        }).where(eq(paymentInvoicesTable.id, invoice.id));

        await auditLog({ userId: req.userId!, action: "create_payment_invoice", entityType: "payment_invoice", entityId: invoice.id, req });
        const safeExpiresAt = npPayment.expiration_estimate_date ? safeDate(npPayment.expiration_estimate_date) : null;
        res.status(201).json(formatInvoice({
          ...invoice,
          providerInvoiceId: String(npPayment.payment_id),
          providerStatus: npPayment.payment_status,
          payCurrency: npPayment.pay_currency,
          payAddress: npPayment.pay_address,
          payAmount: npPayment.pay_amount,
          expiresAt: safeExpiresAt,
        }));
        return;
      }

      if (provider === "mercadopago") {
        if (settings.mercadopagoEnabled !== "true" || !settings.mercadopagoAccessToken) {
          res.status(400).json({ error: "Mercado Pago não está habilitado" });
          return;
        }
        const [user] = await db.select().from((await import("@workspace/db")).usersTable).where(eq((await import("@workspace/db")).usersTable.id, req.userId!));
        const mpResult = await mpCreatePix({
          amount,
          description: `Depósito InvestFlow R$ ${amount.toFixed(2)}`,
          externalReference: String(invoice.id),
          payerName: user?.name,
          payerEmail: user?.email,
          expirationMinutes: 30,
        });
        await db.update(paymentInvoicesTable).set({
          providerInvoiceId: mpResult.id,
          providerStatus: mpResult.status,
          payCurrency: "pix",
          qrCodeUrl: `data:image/png;base64,${mpResult.qrCodeBase64}`,
          payUrl: mpResult.ticketUrl || null,
          expiresAt: mpResult.dateOfExpiration ? new Date(mpResult.dateOfExpiration) : null,
          metadata: mpResult,
        }).where(eq(paymentInvoicesTable.id, invoice.id));

        await auditLog({ userId: req.userId!, action: "create_payment_invoice", entityType: "payment_invoice", entityId: invoice.id, req });
        res.status(201).json(formatInvoice({
          ...invoice,
          providerInvoiceId: mpResult.id,
          providerStatus: mpResult.status,
          payCurrency: "pix",
          qrCodeUrl: `data:image/png;base64,${mpResult.qrCodeBase64}`,
          payUrl: mpResult.ticketUrl || null,
          // also include the "copia e cola" payload for convenience
        }));
        // attach copia-e-cola in response
        return;
      }

      res.status(400).json({ error: "Provedor inválido" });
    } catch (err: any) {
      req.log.error({ err }, "Create payment invoice failed");
      // Mark invoice failed
      await db.update(paymentInvoicesTable).set({ status: "failed", metadata: { error: String(err?.message || err) } })
        .where(eq(paymentInvoicesTable.id, invoice.id));
      res.status(500).json({ error: err?.message || "Falha ao criar fatura de pagamento" });
    }
  } catch (err) {
    req.log.error({ err }, "Create payment invoice error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/:id — status of an invoice (for polling) ───────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.select().from(paymentInvoicesTable)
      .where(eq(paymentInvoicesTable.id, id));
    if (!invoice || invoice.userId !== req.userId) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // If still pending, refresh from the gateway
    if (invoice.status === "pending" && invoice.providerInvoiceId) {
      try {
        if (invoice.provider === "nowpayments") {
          // NowPayments: usamos /payment/{id} (não /invoice) pois criamos payments
          const { getPayment: npGetPayment } = await import("../lib/nowpayments");
          const fresh = await npGetPayment(invoice.providerInvoiceId);
          const mapped = npMapStatus(fresh.payment_status);
          if (mapped !== "pending" || fresh.payment_status !== invoice.providerStatus) {
            await db.update(paymentInvoicesTable).set({
              providerStatus: fresh.payment_status,
              status: mapped,
              payAddress: fresh.pay_address || invoice.payAddress,
              payAmount: fresh.pay_amount ? String(fresh.pay_amount) : invoice.payAmount,
              metadata: fresh,
            }).where(eq(paymentInvoicesTable.id, id));
            invoice.providerStatus = fresh.payment_status;
            invoice.status = mapped;
            if (mapped === "confirmed") {
              await processConfirmedInvoice(id);
            }
          }
        } else if (invoice.provider === "mercadopago") {
          const fresh = await mpGetPayment(invoice.providerInvoiceId);
          const mapped = mpMapStatus(fresh.status);
          if (mapped !== "pending" || fresh.status !== invoice.providerStatus) {
            await db.update(paymentInvoicesTable).set({
              providerStatus: fresh.status,
              status: mapped,
              metadata: fresh,
            }).where(eq(paymentInvoicesTable.id, id));
            invoice.providerStatus = fresh.status;
            invoice.status = mapped;
            if (mapped === "confirmed") {
              await processConfirmedInvoice(id);
            }
          }
        }
      } catch (err) {
        req.log.warn({ err, invoiceId: id }, "Failed to refresh invoice status");
      }
    }

    res.json(formatInvoice(invoice));
  } catch (err) {
    req.log.error({ err }, "Get invoice error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments — list current user's invoices ─────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const invoices = await db.select().from(paymentInvoicesTable)
      .where(eq(paymentInvoicesTable.userId, req.userId!))
      .orderBy(desc(paymentInvoicesTable.createdAt));
    res.json(invoices.map(formatInvoice));
  } catch (err) {
    req.log.error({ err }, "List invoices error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS — public endpoints (no auth). Raw body required for signature check.
// Configured via express.json({ verify }) in app.ts — see verifyWebhookBody.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /payments/webhook/nowpayments ───────────────────────────────────────
router.post("/webhook/nowpayments", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || "";
    const signature = req.headers["x-nowpayments-sig"] as string | undefined;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Idempotency: NowPayments sends payment_id + order_id; use a composite eventId
    const eventId = `np-${payload?.payment_id || payload?.id || "unknown"}-${payload?.order_id || ""}`;

    const [existing] = await db.select().from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, eventId)).limit(1);
    if (existing && existing.processed) {
      res.status(200).json({ message: "already processed" });
      return;
    }

    // Verify signature
    const valid = await npVerifyIpn(typeof rawBody === "string" ? rawBody : JSON.stringify(payload), signature);
    if (!valid) {
      logger.warn({ eventId, signature }, "NowPayments IPN signature invalid — rejecting");
      // Record but mark unprocessed
      if (!existing) {
        await db.insert(webhookEventsTable).values({
          provider: "nowpayments", eventId, payload, processed: false, error: "invalid signature",
        });
      }
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Record event
    if (!existing) {
      await db.insert(webhookEventsTable).values({
        provider: "nowpayments", eventId, payload, processed: false,
      });
    }

    // ── Detect PAYOUT events (auto-split payouts, not deposit invoices) ──
    if (npIsPayoutEvent(payload)) {
      const npPayoutId = String(payload.id || payload.payout_id || "");
      const payoutStatus = String(payload.status || payload.payout_status || "");
      const txHash = payload.tx_hash || payload.transaction_hash || null;
      logger.info({ npPayoutId, payoutStatus }, "NowPayments PAYOUT webhook received");
      await processPayoutWebhook(npPayoutId, payoutStatus, txHash);
      await db.update(webhookEventsTable).set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEventsTable.eventId, eventId));
      res.status(200).json({ message: "payout processed" });
      return;
    }

    // ── DEPOSIT invoice event ──
    const providerInvoiceId = String(payload?.id || payload?.payment_id || "");
    const orderId = String(payload?.order_id || "");
    const [invoice] = await db.select().from(paymentInvoicesTable)
      .where(eq(paymentInvoicesTable.providerInvoiceId, providerInvoiceId)).limit(1)
      || (orderId ? await db.select().from(paymentInvoicesTable)
        .where(eq(paymentInvoicesTable.providerInvoiceId, orderId)).limit(1) : []);

    if (!invoice) {
      logger.warn({ providerInvoiceId, orderId }, "NowPayments webhook: invoice not found");
      res.status(200).json({ message: "invoice not found (ignored)" });
      return;
    }

    const mapped = npMapStatus(payload?.payment_status || payload?.status || "");
    await db.update(paymentInvoicesTable).set({
      providerStatus: payload?.payment_status || payload?.status || invoice.providerStatus,
      status: mapped,
      amountPaid: payload?.actually_paid ? String(payload.actually_paid) : invoice.amountPaid,
      metadata: payload,
    }).where(eq(paymentInvoicesTable.id, invoice.id));

    if (mapped === "confirmed") {
      await processConfirmedInvoice(invoice.id);
    }

    // Mark processed
    await db.update(webhookEventsTable).set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEventsTable.eventId, eventId));

    res.status(200).json({ message: "ok" });
  } catch (err) {
    logger.error({ err }, "NowPayments webhook error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /payments/webhook/mercadopago ───────────────────────────────────────
router.post("/webhook/mercadopago", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || "";
    const signature = req.headers["x-signature"] as string | undefined;
    const requestId = req.headers["x-request-id"] as string | undefined;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Mercado Pago sends: { type: "payment", data: { id: "12345" } }
    const dataId = String(payload?.data?.id || payload?.id || "");
    const eventId = `mp-${dataId}-${payload?.type || ""}`;

    const [existing] = await db.select().from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, eventId)).limit(1);
    if (existing && existing.processed) {
      res.status(200).json({ message: "already processed" });
      return;
    }

    // Verify signature
    const valid = await mpVerifyWebhook(signature, requestId, dataId, typeof rawBody === "string" ? rawBody : JSON.stringify(payload));
    if (!valid) {
      logger.warn({ eventId, signature }, "Mercado Pago webhook signature invalid — rejecting");
      if (!existing) {
        await db.insert(webhookEventsTable).values({
          provider: "mercadopago", eventId, payload, processed: false, error: "invalid signature",
        });
      }
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    if (!existing) {
      await db.insert(webhookEventsTable).values({
        provider: "mercadopago", eventId, payload, processed: false,
      });
    }

    // Only process payment events
    if (payload?.type !== "payment" || !dataId) {
      await db.update(webhookEventsTable).set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEventsTable.eventId, eventId));
      res.status(200).json({ message: "ignored (non-payment)" });
      return;
    }

    // Fetch full payment from MP (webhook only sends the id)
    const payment = await mpGetPayment(dataId);

    // Find our invoice by providerInvoiceId (= MP payment id) or external_reference
    let [invoice] = await db.select().from(paymentInvoicesTable)
      .where(eq(paymentInvoicesTable.providerInvoiceId, dataId)).limit(1);
    if (!invoice && payment) {
      // external_reference holds our invoice.id
      const extRef = (payment as any).external_reference;
      if (extRef) {
        [invoice] = await db.select().from(paymentInvoicesTable)
          .where(eq(paymentInvoicesTable.id, parseInt(extRef))).limit(1);
      }
    }
    if (!invoice) {
      logger.warn({ dataId }, "Mercado Pago webhook: invoice not found");
      res.status(200).json({ message: "invoice not found (ignored)" });
      return;
    }

    const mapped = mpMapStatus(payment.status);
    await db.update(paymentInvoicesTable).set({
      providerStatus: payment.status,
      status: mapped,
      amountPaid: payment.transactionAmount ? String(payment.transactionAmount) : invoice.amountPaid,
      metadata: payment,
    }).where(eq(paymentInvoicesTable.id, invoice.id));

    if (mapped === "confirmed") {
      await processConfirmedInvoice(invoice.id);
    }

    await db.update(webhookEventsTable).set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEventsTable.eventId, eventId));

    res.status(200).json({ message: "ok" });
  } catch (err) {
    logger.error({ err }, "Mercado Pago webhook error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatInvoice(i: typeof paymentInvoicesTable.$inferSelect) {
  return {
    id: i.id,
    provider: i.provider,
    providerInvoiceId: i.providerInvoiceId,
    providerStatus: i.providerStatus,
    status: i.status,
    amountRequested: Number(i.amountRequested),
    priceCurrency: i.priceCurrency,
    payCurrency: i.payCurrency,
    payAmount: i.payAmount ? Number(i.payAmount) : null,
    payAddress: i.payAddress,
    payUrl: i.payUrl,
    qrCodeUrl: i.qrCodeUrl,
    // Include "copia e cola" payload for PIX (stored in metadata.qrCode)
    pixPayload: i.provider === "mercadopago" && i.metadata
      ? ((i.metadata as any)?.qrCode || null) : null,
    expiresAt: i.expiresAt,
    confirmedAt: i.confirmedAt,
    createdAt: i.createdAt,
  };
}

export default router;
