import { db, usersTable, transactionsTable, commissionsTable, notificationsTable,
  partnersTable, partnerSplitsTable, partnerPayoutsTable, paymentInvoicesTable, depositsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSetting } from "./settings";
import { logger } from "./logger";
import { depositToUsd } from "./exchange-rate";
import { createPayout, mapPayoutStatus, type NowPaymentsPayoutResult } from "./nowpayments";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SPLIT ENGINE — Modelo ZyxCompany
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Usuário deposita (ex.: R$550 via PIX ou $100 USDT via NowPayments)
 * 2. Usuário recebe 100% no saldo interno (SEMPRE 100% — o split vem da custódia)
 * 3. processConfirmedInvoice() credita o usuário e chama applyPartnerSplit()
 * 4. applyPartnerSplit():
 *    - Converte o depósito para USD
 *    - Para cada sócio ativo: splitUsd = depositUsd × pct%
 *    - Cria um partner_split (status "credited") — auditoria
 *    - Soma ao partner.balanceDue (acumulado em USD)
 * 5. Se partner.balanceDue >= partner.minPayout AND partner.autoPayout:
 *    - triggerAutoPayout() → createPayout() no NowPayments (envia USDT real)
 *    - Sucesso: zera balanceDue, marca splits "processing", cria partner_payout
 *    - Falha: NÃO zera, acumula para próxima tentativa
 * 6. Webhook do NowPayments confirma o payout → marca splits "paid", totalPaid +=
 * 7. Se o payout falhar (webhook): devolve ao balanceDue, marca splits "credited"
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Credit a confirmed payment to the user's balance + record transaction +
 * referral commission + partner split. Idempotent.
 */
export async function processConfirmedInvoice(invoiceId: number): Promise<{ processed: boolean; reason?: string }> {
  const [invoice] = await db.select().from(paymentInvoicesTable)
    .where(eq(paymentInvoicesTable.id, invoiceId));
  if (!invoice) return { processed: false, reason: "invoice not found" };
  if (invoice.status === "confirmed") return { processed: false, reason: "already confirmed" };

  const amount = Number(invoice.amountRequested);
  if (amount <= 0) return { processed: false, reason: "invalid amount" };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.userId));
  if (!user) return { processed: false, reason: "user not found" };

  // 1. Mark invoice confirmed
  await db.update(paymentInvoicesTable).set({
    status: "confirmed",
    providerStatus: invoice.providerStatus,
    confirmedAt: new Date(),
  }).where(eq(paymentInvoicesTable.id, invoiceId));

  // 2. USER ALWAYS RECEIVES 100% — Split comes from custody account, not user balance
  const balanceBefore = Number(user.balance);
  const balanceAfter = balanceBefore + amount;
  await db.update(usersTable).set({ balance: String(balanceAfter) })
    .where(eq(usersTable.id, user.id));

  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    description: `Depósito confirmado via ${invoice.provider} (${invoice.payCurrency || "—"})`,
    referenceId: invoiceId,
    referenceType: "payment_invoice",
  });

  // 3. Create a matching legacy deposit row
  const [deposit] = await db.insert(depositsTable).values({
    userId: user.id,
    method: (invoice.payCurrency === "pix" ? "pix" : "usdt_bep20") as any,
    amount: String(amount),
    status: "confirmed",
    walletAddress: invoice.payAddress,
    transactionHash: invoice.providerInvoiceId,
    qrCodeUrl: invoice.qrCodeUrl,
    notes: `Auto-confirmado via ${invoice.provider}`,
    confirmedAt: new Date(),
    confirmedBy: null,
  }).returning();

  await db.update(paymentInvoicesTable).set({
    referenceType: "deposit",
    referenceId: deposit.id,
  }).where(eq(paymentInvoicesTable.id, invoiceId));

  await db.insert(notificationsTable).values({
    userId: user.id,
    title: "Depósito confirmado",
    message: `Seu depósito de ${invoice.priceCurrency} ${amount.toFixed(2)} foi confirmado e creditado na sua conta.`,
    type: "success",
  });

  // 4. Referral commission (1 level)
  await applyReferralCommission(user.id, amount, deposit.id);

  // 5. Partner split (modelo ZyxCompany)
  await applyPartnerSplit(user.id, amount, invoice.priceCurrency, invoiceId, deposit.id);

  logger.info({ invoiceId, userId: user.id, amount }, "Payment invoice confirmed & processed");
  return { processed: true };
}

/** Referral commission — idempotent, one per deposit. */
async function applyReferralCommission(userId: number, amount: number, depositId: number): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.referredBy) return;

  const [existing] = await db.select({ id: commissionsTable.id })
    .from(commissionsTable)
    .where(and(eq(commissionsTable.fromUserId, userId), eq(commissionsTable.referenceId, depositId)))
    .limit(1);
  if (existing) return;

  const rate = Number(await getSetting("referralCommissionPercent")) || 0;
  if (rate <= 0) return;

  const commissionAmount = parseFloat((amount * rate / 100).toFixed(8));
  if (commissionAmount <= 0) return;

  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, user.referredBy));
  if (!referrer) return;

  const refBefore = Number(referrer.balance);
  const refAfter = refBefore + commissionAmount;
  await db.update(usersTable).set({ balance: String(refAfter) })
    .where(eq(usersTable.id, referrer.id));

  await db.insert(commissionsTable).values({
    userId: referrer.id, fromUserId: user.id, amount: String(commissionAmount),
    rate: String(rate), level: 1, status: "paid", referenceId: depositId, paidAt: new Date(),
  });

  await db.insert(transactionsTable).values({
    userId: referrer.id, type: "commission", amount: String(commissionAmount),
    balanceBefore: String(refBefore), balanceAfter: String(refAfter),
    description: `Bônus de indicação — depósito de ${user.name}`, referenceId: depositId, referenceType: "deposit",
  });

  await db.insert(notificationsTable).values({
    userId: referrer.id, title: "Bônus de indicação creditado",
    message: `${commissionAmount.toFixed(2)} creditados pelo depósito de ${user.name}.`, type: "success",
  });
}

/**
 * Partner split — distribute % to each active partner, accumulating in USD.
 * Then trigger auto-payout if threshold reached.
 */
export async function applyPartnerSplit(
  userId: number,
  amount: number,
  currency: string,
  invoiceId: number,
  depositId: number,
): Promise<void> {
  const splitEnabled = (await getSetting("partnerSplitEnabled")) !== "false";
  if (!splitEnabled) return;

  const partners = await db.select().from(partnersTable)
    .where(eq(partnersTable.status, "active"));
  if (partners.length === 0) return;

  // Convert deposit to USD
  const depositUsd = await depositToUsd(amount, currency);

  const totalPct = partners.reduce((a, p) => a + Number(p.splitPercent), 0);
  if (totalPct <= 0) return;
  const normalizationFactor = totalPct > 100 ? 100 / totalPct : 1;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const userName = user?.name || "Cliente";

  for (const partner of partners) {
    const rawPct = Number(partner.splitPercent);
    const effectivePct = rawPct * normalizationFactor;
    const splitUsd = parseFloat((depositUsd * effectivePct / 100).toFixed(8));
    if (splitUsd <= 0) continue;

    // Idempotency
    const [existing] = await db.select({ id: partnerSplitsTable.id })
      .from(partnerSplitsTable)
      .where(and(
        eq(partnerSplitsTable.partnerId, partner.id),
        eq(partnerSplitsTable.paymentInvoiceId, invoiceId),
      ))
      .limit(1);
    if (existing) continue;

    // Create SplitLog (status "credited" = accumulated)
    await db.insert(partnerSplitsTable).values({
      partnerId: partner.id,
      paymentInvoiceId: invoiceId,
      userId,
      baseAmount: String(amount),
      baseCurrency: currency,
      amountUsd: String(splitUsd),
      splitPercent: String(effectivePct),
      amount: String(parseFloat((amount * effectivePct / 100).toFixed(8))),
      status: "credited",
      description: `Split de depósito — ${currency} ${amount.toFixed(2)} (≈ $${splitUsd.toFixed(2)} USD) de ${userName}`,
    });

    // Accumulate to partner balance (in USD)
    const newBalanceDue = Number(partner.balanceDue) + splitUsd;
    const newTotalEarned = Number(partner.totalEarned) + splitUsd;
    await db.update(partnersTable).set({
      balanceDue: String(newBalanceDue),
      totalEarned: String(newTotalEarned),
    }).where(eq(partnersTable.id, partner.id));

    logger.info({ partnerId: partner.id, invoiceId, splitUsd, newBalanceDue }, "Partner split accumulated");

    // Trigger auto-payout if threshold reached
    if (partner.autoPayout && newBalanceDue >= Number(partner.minPayout)) {
      await triggerAutoPayout(partner.id).catch((err) => {
        logger.error({ err, partnerId: partner.id }, "Auto-payout trigger failed (non-fatal, will retry)");
      });
    }
  }
}

/**
 * Trigger an automatic payout for a partner via NowPayments.
 * Sends the full accumulated balance (balanceDue) as USDT to the partner's wallet.
 * On success: zeros balanceDue, marks credited splits as "processing".
 * On failure: keeps balanceDue, will retry on next deposit or via cron.
 */
export async function triggerAutoPayout(partnerId: number): Promise<{ payoutId: number | null; success: boolean; reason?: string }> {
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, partnerId));
  if (!partner) return { payoutId: null, success: false, reason: "partner not found" };
  if (!partner.autoPayout) return { payoutId: null, success: false, reason: "auto-payout disabled" };

  const accumulated = Number(partner.balanceDue);
  if (accumulated < Number(partner.minPayout)) {
    return { payoutId: null, success: false, reason: `below minPayout (${accumulated} < ${partner.minPayout})` };
  }
  if (!partner.payoutWallet) {
    logger.warn({ partnerId }, "Auto-payout skipped: no payout wallet configured");
    return { payoutId: null, success: false, reason: "no payout wallet" };
  }

  // Don't trigger if there's already a pending/processing payout for this partner
  const pendingPayout = Number(partner.pendingPayout);
  if (pendingPayout > 0) {
    return { payoutId: null, success: false, reason: "payout already in progress" };
  }

  const settings = await import("./settings").then(m => m.getSecretSettings());
  if (settings.nowpaymentsEnabled !== "true" || !settings.nowpaymentsApiKey) {
    logger.warn({ partnerId }, "Auto-payout skipped: NowPayments not configured");
    return { payoutId: null, success: false, reason: "NowPayments not configured" };
  }

  const payoutAmount = parseFloat(accumulated.toFixed(2)); // USDT amount (USD ≈ USDT 1:1)
  const externalId = `split-${partnerId}-${Date.now()}`;
  const ipnCallbackUrl = `${process.env.SITE_URL || "https://flashymining.com"}/api/payments/webhook/nowpayments`;

  // Create partner_payout record (status pending)
  const [payout] = await db.insert(partnerPayoutsTable).values({
    partnerId,
    amount: String(payoutAmount),
    usdAmount: String(accumulated),
    currency: partner.payoutCurrency,
    method: "nowpayments",
    destination: partner.payoutWallet,
    externalId,
    status: "pending",
    notes: `Auto-payout — saldo acumulado $${accumulated.toFixed(2)}`,
  }).returning();

  try {
    const npResult: NowPaymentsPayoutResult = await createPayout({
      address: partner.payoutWallet,
      currency: partner.payoutCurrency,
      amount: payoutAmount,
      ipnCallbackUrl,
      externalId,
    });

    const mapped = mapPayoutStatus(npResult.status);

    if (mapped === "failed") {
      // Payout rejected at creation — don't zero balance, will retry
      await db.update(partnerPayoutsTable).set({
        providerPayoutId: String(npResult.id),
        providerStatus: npResult.status,
        status: "failed",
        failureReason: npResult.error || "creation rejected",
        processedAt: new Date(),
      }).where(eq(partnerPayoutsTable.id, payout.id));
      logger.warn({ partnerId, payoutId: payout.id, npResult }, "Auto-payout creation failed — balance preserved");
      return { payoutId: payout.id, success: false, reason: npResult.error || "creation rejected" };
    }

    // Payout accepted (processing or awaiting_confirmation) — ZERO the balance
    const isAwaiting = mapped === "awaiting_confirmation";
    await db.update(partnerPayoutsTable).set({
      providerPayoutId: String(npResult.id),
      providerBatchId: npResult.batch_id ? String(npResult.batch_id) : null,
      providerStatus: npResult.status,
      status: isAwaiting ? "awaiting_confirmation" : "processing",
      transactionHash: npResult.tx_hash || null,
    }).where(eq(partnerPayoutsTable.id, payout.id));

    // Zero balanceDue, move to pendingPayout
    await db.update(partnersTable).set({
      balanceDue: "0",
      pendingPayout: String(accumulated),
    }).where(eq(partnersTable.id, partnerId));

    // Mark all credited splits as processing + link to payout
    await db.update(partnerSplitsTable).set({
      status: "processing",
      payoutId: payout.id,
    }).where(and(
      eq(partnerSplitsTable.partnerId, partnerId),
      eq(partnerSplitsTable.status, "credited"),
    ));

    logger.info({ partnerId, payoutId: payout.id, npPayoutId: npResult.id, amount: payoutAmount, status: mapped },
      "Auto-payout created via NowPayments");

    if (isAwaiting) {
      // Notify admin that confirmation is needed
      await db.insert(notificationsTable).values({
        userId: null,
        title: "Payout aguardando confirmação",
        message: `Payout #${payout.id} de $${payoutAmount} para ${partner.name} aguarda código 2FA do NowPayments.`,
        type: "warning",
      }).then(() => {}).catch(() => {});
    }

    return { payoutId: payout.id, success: true };
  } catch (err: any) {
    // Creation threw — mark payout failed, keep balance
    await db.update(partnerPayoutsTable).set({
      status: "failed",
      failureReason: String(err?.message || err),
      processedAt: new Date(),
    }).where(eq(partnerPayoutsTable.id, payout.id));
    logger.error({ err, partnerId, payoutId: payout.id }, "Auto-payout creation error — balance preserved");
    return { payoutId: payout.id, success: false, reason: String(err?.message || err) };
  }
}

/**
 * Process a payout IPN from NowPayments (called from webhook).
 * Updates payout status; on completion marks splits "paid" + adds to totalPaid.
 * On failure, reverts: re-adds to balanceDue, marks splits "credited".
 */
export async function processPayoutWebhook(npPayoutId: string, providerStatus: string, txHash?: string | null): Promise<void> {
  const [payout] = await db.select().from(partnerPayoutsTable)
    .where(eq(partnerPayoutsTable.providerPayoutId, npPayoutId)).limit(1);
  if (!payout) {
    logger.warn({ npPayoutId }, "Payout webhook: payout not found");
    return;
  }
  if (payout.status === "completed" || payout.status === "failed") {
    return; // already finalized
  }

  const mapped = mapPayoutStatus(providerStatus);
  const usdAmount = Number(payout.usdAmount);

  if (mapped === "completed") {
    await db.update(partnerPayoutsTable).set({
      providerStatus, status: "completed", transactionHash: txHash || null, processedAt: new Date(),
    }).where(eq(partnerPayoutsTable.id, payout.id));

    // Mark splits as paid
    await db.update(partnerSplitsTable).set({ status: "paid", paidAt: new Date() })
      .where(and(eq(partnerSplitsTable.payoutId, payout.id), eq(partnerSplitsTable.status, "processing")));

    // Move pendingPayout → totalPaid
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, payout.partnerId));
    if (partner) {
      await db.update(partnersTable).set({
        pendingPayout: "0",
        totalPaid: String(Number(partner.totalPaid) + usdAmount),
      }).where(eq(partnersTable.id, partner.id));
    }
    logger.info({ payoutId: payout.id, npPayoutId, usdAmount }, "Payout completed — USDT sent to partner");

  } else if (mapped === "failed") {
    // Revert: re-add to balanceDue, mark splits back to credited
    await db.update(partnerPayoutsTable).set({
      providerStatus, status: "failed", processedAt: new Date(),
    }).where(eq(partnerPayoutsTable.id, payout.id));

    await db.update(partnerSplitsTable).set({ status: "credited", payoutId: null })
      .where(and(eq(partnerSplitsTable.payoutId, payout.id), eq(partnerSplitsTable.status, "processing")));

    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, payout.partnerId));
    if (partner) {
      await db.update(partnersTable).set({
        balanceDue: String(Number(partner.balanceDue) + usdAmount),
        pendingPayout: "0",
      }).where(eq(partnersTable.id, partner.id));
    }
    logger.warn({ payoutId: payout.id, npPayoutId, usdAmount }, "Payout FAILED — balance restored to partner");
  } else {
    // processing / awaiting_confirmation — just update status
    await db.update(partnerPayoutsTable).set({
      providerStatus,
      status: mapped === "awaiting_confirmation" ? "awaiting_confirmation" : "processing",
      transactionHash: txHash || null,
    }).where(eq(partnerPayoutsTable.id, payout.id));
  }
}
