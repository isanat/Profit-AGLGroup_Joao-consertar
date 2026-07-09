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
    // "confirming" = recebido na blockchain aguardando confirmações
    // "sending" / "confirmed" = pago — tratamos como confirmado para crédito
    return s === "confirming" ? "confirming" : "confirmed";
  }
  if (["finished", "paid"].includes(s)) return "confirmed";
  if (["expired", "expired_time"].includes(s)) return "expired";
  if (["failed", "refunded", "canceled"].includes(s)) return "failed";
  return "pending";
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
