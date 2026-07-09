import crypto from "node:crypto";
import { getSecretSettings } from "./settings";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NowPaymentsCreateInvoiceInput {
  priceAmount: number;        // valor a pagar (ex: 150.00)
  priceCurrency: string;      // moeda do preço (ex: "BRL", "USD")
  payCurrency?: string;       // moeda de pagamento (ex: "btc", "usdttrc20") — se vazio, usuário escolhe
  orderId: string;            // ID interno para conciliação
  orderDescription?: string;
  successUrl?: string;
  canceledUrl?: string;
}

export interface NowPaymentsInvoice {
  id: string;
  token_id?: string;
  url: string;              // URL da página de pagamento do NowPayments
  status: string;           // "waiting" | "confirming" | "confirmed" | "sending" | "finished" | "failed" | "expired" | "refunded"
  price_amount: number;
  price_currency: string;
  pay_currency?: string;
  pay_amount?: number;
  pay_address?: string;
  purchase_id?: string;
  order_id?: string;
  order_description?: string;
  created_at: number;
  updated_at?: number;
  expiration_estimate_date?: number;
  expire_at?: number;
}

// ─── Internal HTTP helper ─────────────────────────────────────────────────────
async function nowpaymentsFetch(path: string, options: RequestInit = {}): Promise<any> {
  const settings = await getSecretSettings();
  const baseUrl = (settings.nowpaymentsBaseUrl || "https://api.nowpayments.io/v1").replace(/\/+$/, "");
  const apiKey = settings.nowpaymentsApiKey;
  if (!apiKey) {
    throw new Error("NowPayments API key is not configured");
  }
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  const resp = await fetch(url, { ...options, headers });
  const text = await resp.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!resp.ok) {
    logger.error({ url, status: resp.status, body }, "NowPayments API error");
    throw new Error(`NowPayments API error ${resp.status}: ${typeof body === "object" ? JSON.stringify(body) : body}`);
  }
  return body;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a hosted invoice. The user is redirected to `url` to pay. */
export async function createInvoice(input: NowPaymentsCreateInvoiceInput): Promise<NowPaymentsInvoice> {
  const body: Record<string, unknown> = {
    price_amount: input.priceAmount,
    price_currency: input.priceCurrency,
    order_id: input.orderId,
    order_description: input.orderDescription || `InvestFlow #${input.orderId}`,
    is_fixed_rate: true,
    is_fee_paid_by_user: true,
  };
  if (input.payCurrency) body.pay_currency = input.payCurrency;
  if (input.successUrl) body.success_url = input.successUrl;
  if (input.canceledUrl) body.canceled_url = input.canceledUrl;

  const result = await nowpaymentsFetch("/invoice", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result as NowPaymentsInvoice;
}

/** Fetch the current status of an invoice by its NowPayments id. */
export async function getInvoice(invoiceId: string): Promise<NowPaymentsInvoice> {
  return await nowpaymentsFetch(`/invoice/${invoiceId}`, { method: "GET" }) as NowPaymentsInvoice;
}

/**
 * Verify the IPN signature from NowPayments.
 * NowPayments sends `x-nowpayments-sig` = base64(HMAC-SHA512(body, ipnSecret)).
 * Returns true if the signature is valid.
 */
export async function verifyIpnSignature(rawBody: string, signatureHeader: string | undefined): Promise<boolean> {
  const settings = await getSecretSettings();
  const secret = settings.nowpaymentsIpnSecret;
  if (!secret) {
    logger.warn("NowPayments IPN secret is not configured — rejecting all IPNs");
    return false;
  }
  if (!signatureHeader) return false;
  try {
    const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    const received = signatureHeader.trim().toLowerCase();
    // NowPayments sends hex; compare in constant time
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    logger.error({ err }, "IPN signature verification failed");
    return false;
  }
}

/** Map NowPayments status → our internal invoice status enum. */
export function mapNowPaymentsStatus(status: string): "pending" | "confirming" | "confirmed" | "expired" | "failed" {
  const s = (status || "").toLowerCase();
  if (["waiting", "new"].includes(s)) return "pending";
  if (["confirming", "confirmed", "sending"].includes(s)) {
    return s === "confirming" ? "confirming" : "confirmed";
  }
  if (["finished", "paid"].includes(s)) return "confirmed";
  if (["expired", "expired_time"].includes(s)) return "expired";
  if (["failed", "refunded", "canceled"].includes(s)) return "failed";
  return "pending";
}

/**
 * Lista as moedas HABILITADAS para pagamento no NowPayments.
 * Usa /full-currencies que retorna objetos com campo is_enabled (true/false),
 * filtrando APENAS as moedas que o merchant liberou na conta.
 * (O endpoint /currencies simples retorna todas as suportadas, sem filtro.)
 */
export async function getAvailableCurrencies(): Promise<{ code: string; label: string; network?: string }[]> {
  try {
    // /full-currencies retorna { currencies: [{ id, code, is_enabled, ... }, ...] }
    const result = await nowpaymentsFetch("/full-currencies", { method: "GET" });
    const all: any[] = Array.isArray(result) ? result : (result.currencies || []);
    const labelMap: Record<string, { label: string; network: string }> = {
      btc: { label: "Bitcoin (BTC)", network: "Bitcoin" },
      usdttrc20: { label: "USDT (TRC20 / Tron)", network: "Tron" },
      usdtbsc: { label: "USDT (BEP20 / BSC)", network: "BSC" },
      usdterc20: { label: "USDT (ERC20 / Ethereum)", network: "Ethereum" },
      usdc: { label: "USDC (ERC20)", network: "Ethereum" },
      usdcbsc: { label: "USDC (BEP20 / BSC)", network: "BSC" },
      bnb: { label: "BNB (BEP20)", network: "BSC" },
      eth: { label: "Ethereum (ETH)", network: "Ethereum" },
      trx: { label: "Tron (TRX)", network: "Tron" },
      ltc: { label: "Litecoin (LTC)", network: "Litecoin" },
      doge: { label: "Dogecoin (DOGE)", network: "Dogecoin" },
      sol: { label: "Solana (SOL)", network: "Solana" },
    };
    // Filtrar: is_enabled === true E está no nosso labelMap (moedas conhecidas)
    return all
      .filter((c) => c.is_enabled === true && labelMap[c.code || c.id])
      .map((c) => {
        const code = c.code || c.id;
        return { code, ...labelMap[code] };
      });
  } catch (err) {
    logger.error({ err }, "Failed to fetch NowPayments full-currencies — falling back to /currencies");
    // Fallback: /currencies (retorna todas, sem filtro de is_enabled)
    try {
      const result = await nowpaymentsFetch("/currencies", { method: "GET" });
      const codes: string[] = Array.isArray(result) ? result : (result.currencies || []);
      const labelMap: Record<string, { label: string; network: string }> = {
        btc: { label: "Bitcoin (BTC)", network: "Bitcoin" },
        usdttrc20: { label: "USDT (TRC20 / Tron)", network: "Tron" },
        usdtbsc: { label: "USDT (BEP20 / BSC)", network: "BSC" },
        usdterc20: { label: "USDT (ERC20 / Ethereum)", network: "Ethereum" },
        usdc: { label: "USDC (ERC20)", network: "Ethereum" },
        usdcbsc: { label: "USDC (BEP20 / BSC)", network: "BSC" },
        bnb: { label: "BNB (BEP20)", network: "BSC" },
        eth: { label: "Ethereum (ETH)", network: "Ethereum" },
        trx: { label: "Tron (TRX)", network: "Tron" },
        ltc: { label: "Litecoin (LTC)", network: "Litecoin" },
        doge: { label: "Dogecoin (DOGE)", network: "Dogecoin" },
        sol: { label: "Solana (SOL)", network: "Solana" },
      };
      return codes.filter((c) => labelMap[c]).map((c) => ({ code: c, ...labelMap[c] }));
    } catch (err2) {
      logger.error({ err: err2 }, "Failed to fetch NowPayments currencies (fallback)");
      return [];
    }
  }
}

export interface NowPaymentsPaymentResult {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  expiration_estimate_date?: number;
  qr_code?: string; // some responses include this
  created_at: number;
  updated_at?: number;
}

/**
 * Cria um PAYMENT (não invoice) — retorna endereço de carteira + valor direto,
 * sem página hosted. O usuário copia o endereço e paga.
 * Requer pay_currency (moeda específica que o merchant liberou).
 */
export async function createPayment(input: NowPaymentsCreateInvoiceInput): Promise<NowPaymentsPaymentResult> {
  if (!input.payCurrency) {
    throw new Error("payCurrency is required for createPayment (use createInvoice for hosted page)");
  }
  const body: Record<string, unknown> = {
    price_amount: input.priceAmount,
    price_currency: input.priceCurrency,
    pay_currency: input.payCurrency,
    order_id: input.orderId,
    order_description: input.orderDescription || `InvestFlow #${input.orderId}`,
    is_fixed_rate: true,
    is_fee_paid_by_user: true,
  };
  if (input.successUrl) body.success_url = input.successUrl;
  if (input.canceledUrl) body.canceled_url = input.canceledUrl;

  const result = await nowpaymentsFetch("/payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result as NowPaymentsPaymentResult;
}

/**
 * Lista de moedas suportadas pelo NowPayments (subset popular para o seletor do frontend).
 * A lista completa pode ser obtida via GET /v1/currencies — aqui usamos as mais comuns.
 */
export const NOWPAYMENTS_POPULAR_CURRENCIES = [
  { code: "btc", label: "Bitcoin (BTC)", network: "Bitcoin" },
  { code: "usdttrc20", label: "USDT (TRC20 / Tron)", network: "Tron" },
  { code: "usdtbsc", label: "USDT (BEP20 / BSC)", network: "BSC" },
  { code: "usdterc20", label: "USDT (ERC20 / Ethereum)", network: "Ethereum" },
  { code: "usdc", label: "USDC (ERC20)", network: "Ethereum" },
  { code: "usdcbsc", label: "USDC (BEP20 / BSC)", network: "BSC" },
  { code: "bnb", label: "BNB (BEP20)", network: "BSC" },
  { code: "eth", label: "Ethereum (ETH)", network: "Ethereum" },
  { code: "trx", label: "Tron (TRX)", network: "Tron" },
  { code: "ltc", label: "Litecoin (LTC)", network: "Litecoin" },
  { code: "doge", label: "Dogecoin (DOGE)", network: "Dogecoin" },
  { code: "sol", label: "Solana (SOL)", network: "Solana" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUTS — enviar cripto para carteira de sócios (auto-split)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica o saldo da conta NowPayments (para payouts).
 * IMPORTANTE: NowPayments exige email + 2FA configurados na conta para permitir
 * payouts via API. Se esta chamada falhar com erro de permissão, significa que
 * a conta não está habilitada para payouts.
 *
 * Retorna os saldos por moeda. Se conseguir ler, a API key tem permissão de payout.
 */
export async function getBalance(): Promise<Record<string, number>> {
  const result = await nowpaymentsFetch("/balance", { method: "GET" });
  // Resultado: [{ currency, amount, ... }, ...]
  const balances: Record<string, number> = {};
  if (Array.isArray(result)) {
    for (const b of result) {
      if (b.currency) balances[b.currency] = Number(b.amount ?? 0);
    }
  }
  return balances;
}

export interface NowPaymentsPayoutResult {
  id: number;
  batch_id?: number;
  amount: number;
  currency: string;
  address: string;
  status: string;     // CREATED | PROCESSING | FINISHED | FAILED | WAITING
  tx_hash?: string | null;
  ipn_callback_url?: string;
  unique_external_id?: string;
  error?: string;
}

export interface CreatePayoutInput {
  address: string;       // carteira de destino
  currency: string;      // ex.: "usdtbsc"
  amount: number;        // valor na moeda
  ipnCallbackUrl: string;
  externalId: string;    // idempotency key (nosso partner_payouts.id)
}

/**
 * Cria um payout (saque) via NowPayments.
 * O dinheiro é enviado da conta custódia do NowPayments para a carteira informada.
 *
 * 2FA AUTOMÁTICO: se o setting nowpayments2faSecret estiver configurado (TOTP
 * secret do Google Authenticator da conta NowPayments), o payout é verificado
 * automaticamente gerando um código TOTP e chamando POST /payout/{id}/verify.
 * Isso elimina a necessidade de digitar código/email — o payout é processado
 * em segundos, sem intervenção humana.
 *
 * Se o secret não estiver configurado ou a verificação falhar, o payout fica
 * "awaiting_confirmation" para confirmação manual.
 */
export async function createPayout(input: CreatePayoutInput): Promise<NowPaymentsPayoutResult> {
  const body = {
    address: input.address,
    currency: input.currency,
    amount: input.amount,
    ipn_callback_url: input.ipnCallbackUrl,
    unique_external_id: input.externalId,
  };
  const result = await nowpaymentsFetch("/payout", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NowPaymentsPayoutResult;

  // ── AUTO-VERIFY 2FA via TOTP ───────────────────────────────────────────────
  // NowPayments cria o payout em status "WAITING" e exige verificação 2FA para
  // processar. Usando o mesmo TOTP secret do Google Authenticator, geramos o
  // código localmente e chamamos /verify — 100% automático, sem email.
  const settings = await getSecretSettings();
  const twoFaSecret = settings.nowpayments2faSecret;
  const batchId = result.batch_id;

  if (twoFaSecret && batchId) {
    try {
      const { authenticator } = await import("otplib");
      const code = authenticator.generate(twoFaSecret);
      logger.info({ batchId }, "NowPayments: auto-verifying payout with TOTP 2FA");
      // POST /payout/{batch_id}/verify
      await nowpaymentsFetch(`/payout/${batchId}/verify`, {
        method: "POST",
        body: JSON.stringify({ verification_code: code }),
      });
      logger.info({ batchId }, "NowPayments: payout 2FA verified successfully");
      // Update status — NowPayments now processes the payout
      result.status = "PROCESSING";
    } catch (verifyErr: any) {
      logger.error({ err: verifyErr, batchId }, "NowPayments: 2FA verification failed (payout created but needs manual verify)");
      // Don't throw — the payout IS created, just needs manual verification.
      // The auto-refund cron will check real status via API.
    }
  } else if (!twoFaSecret) {
    logger.warn("NowPayments: 2FA secret not configured — payout needs manual verification");
  }

  return result;
}

/**
 * Confirma um payout com o código de verificação enviado por email (2FA).
 * Necessário apenas se a conta NowPayments exigir 2FA para payouts.
 */
export async function confirmPayout(payoutId: number, verificationCode: string): Promise<NowPaymentsPayoutResult> {
  const result = await nowpaymentsFetch(`/payout/${payoutId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ verification_code: verificationCode }),
  });
  return result as NowPaymentsPayoutResult;
}

/**
 * Consulta o status de um payout pelo ID.
 */
export async function getPayout(payoutId: number): Promise<NowPaymentsPayoutResult> {
  const result = await nowpaymentsFetch(`/payout/${payoutId}`, { method: "GET" });
  return result as NowPaymentsPayoutResult;
}

/**
 * Mapeia o status de payout do NowPayments → nosso enum interno.
 * CREATED/WAITING = aguardando confirmação 2FA
 * PROCESSING/SENDING = enviado, aguardando confirmação na rede
 * FINISHED/SENT = concluído
 * FAILED/CANCELLED = falhou
 */
export function mapPayoutStatus(status: string): "awaiting_confirmation" | "processing" | "completed" | "failed" {
  const s = (status || "").toLowerCase();
  if (["created", "waiting", "awaiting"].includes(s)) return "awaiting_confirmation";
  if (["processing", "sending", "in_process"].includes(s)) return "processing";
  if (["finished", "sent", "completed", "done"].includes(s)) return "completed";
  if (["failed", "cancelled", "canceled", "rejected", "refunded"].includes(s)) return "failed";
  return "processing"; // unknown → assume processing (safe default)
}

/** Detecta se um payload de webhook do NowPayments é um evento de payout (não de depósito). */
export function isPayoutEvent(payload: any): boolean {
  if (!payload) return false;
  // Payout IPNs incluem batch_id ou type=payout ou o campo payout_id
  return Boolean(
    payload.batch_id ||
    payload.type === "payout" ||
    payload.payout_id ||
    (payload.id && payload.address && payload.currency && payload.amount && !payload.order_id && !payload.payment_id)
  );
}
