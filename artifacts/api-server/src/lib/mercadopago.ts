import crypto from "node:crypto";
import { getSecretSettings } from "./settings";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MercadoPagoPixInput {
  amount: number;          // valor em BRL
  description: string;     // descrição da cobrança
  externalReference: string; // ID interno (nosso payment_invoice.id)
  payerName?: string;
  payerEmail?: string;
  payerDocument?: string;
  expirationMinutes?: number; // padrão 30
}

export interface MercadoPagoPixResult {
  id: string;               // ID do pagamento no MP
  status: string;           // "pending" | "approved" | "rejected" | "cancelled" | "expired"
  statusDetail: string;
  qrCode: string;           // payload "copia e cola" (EMV)
  qrCodeBase64: string;     // imagem base64 do QR code
  ticketUrl?: string;
  dateCreated: string;
  dateOfExpiration?: string;
  transactionAmount: number;
}

// ─── Internal HTTP ────────────────────────────────────────────────────────────
async function mpFetch(path: string, options: RequestInit = {}): Promise<any> {
  const settings = await getSecretSettings();
  const baseUrl = (settings.mercadopagoBaseUrl || "https://api.mercadopago.com/v1").replace(/\/+$/, "");
  const token = settings.mercadopagoAccessToken;
  if (!token) throw new Error("Mercado Pago access token is not configured");
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(),
    ...(options.headers as Record<string, string> || {}),
  };
  const resp = await fetch(url, { ...options, headers });
  const text = await resp.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!resp.ok) {
    logger.error({ url, status: resp.status, body }, "Mercado Pago API error");
    throw new Error(`Mercado Pago API error ${resp.status}: ${typeof body === "object" ? JSON.stringify(body) : body}`);
  }
  return body;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Cria uma cobrança PIX dinâmica no Mercado Pago.
 * Retorna o payload "copia e cola" + imagem QR Code base64.
 */
export async function createPixPayment(input: MercadoPagoPixInput): Promise<MercadoPagoPixResult> {
  const expirationMinutes = input.expirationMinutes ?? 30;
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

  const body = {
    transaction_amount: input.amount,
    description: input.description,
    payment_method_id: "pix",
    external_reference: input.externalReference,
    date_of_expiration: expiresAt,
    payer: {
      name: input.payerName || "Cliente InvestFlow",
      email: input.payerEmail || "cliente@flashymining.com",
      ...(input.payerDocument ? {
        identification: { type: input.payerDocument.length > 11 ? "CNPJ" : "CPF", number: input.payerDocument }
      } : {}),
    },
    // Configura o ponto de interação para PIX dinâmico
    point_of_interaction: {
      type: "PIX",
    },
  };

  const result = await mpFetch("/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const txData = result.point_of_interaction?.transaction_data || {};
  return {
    id: String(result.id),
    status: result.status,
    statusDetail: result.status_detail,
    qrCode: txData.qr_code || "",
    qrCodeBase64: txData.qr_code_base64 || "",
    ticketUrl: txData.ticket_url,
    dateCreated: result.date_created,
    dateOfExpiration: result.date_of_expiration,
    transactionAmount: result.transaction_amount,
  };
}

/** Consulta o status de um pagamento PIX pelo ID. */
export async function getPayment(paymentId: string): Promise<MercadoPagoPixResult> {
  const result = await mpFetch(`/payments/${paymentId}`, { method: "GET" });
  const txData = result.point_of_interaction?.transaction_data || {};
  return {
    id: String(result.id),
    status: result.status,
    statusDetail: result.status_detail,
    qrCode: txData.qr_code || "",
    qrCodeBase64: txData.qr_code_base64 || "",
    dateCreated: result.date_created,
    dateOfExpiration: result.date_of_expiration,
    transactionAmount: result.transaction_amount,
  };
}

/**
 * Verifica a assinatura do webhook do Mercado Pago (x-signature).
 * Formato: ts=<timestamp>,v1=<hmac>
 * Sobre: hash(HMAC-SHA256(data_id + requestId + requestTs, secret))
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function verifyWebhookSignature(
  signatureHeader: string | undefined,
  requestId: string | undefined,
  dataId: string | undefined,
  rawBody: string,
): Promise<boolean> {
  const settings = await getSecretSettings();
  const secret = settings.mercadopagoWebhookSecret;
  if (!secret) {
    // Se não configurou secret, aceita (mas NÃO recomendado em produção)
    logger.warn("Mercado Pago webhook secret not configured — accepting without verification");
    return true;
  }
  if (!signatureHeader) return false;

  try {
    // Parse "ts=...,v1=..."
    const parts = signatureHeader.split(",").map(s => s.trim());
    let ts = "";
    let v1 = "";
    for (const p of parts) {
      const [k, v] = p.split("=");
      if (k === "ts") ts = v;
      if (k === "v1") v1 = v;
    }
    if (!ts || !v1) return false;

    // Manifest = ts + request body (template)
    const manifest = `${ts}${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    logger.error({ err }, "Mercado Pago webhook verification failed");
    return false;
  }
}

/** Mapeia status do Mercado Pago → nosso enum interno. */
export function mapMercadoPagoStatus(status: string): "pending" | "confirming" | "confirmed" | "expired" | "failed" {
  const s = (status || "").toLowerCase();
  if (["approved", "accredited"].includes(s)) return "confirmed";
  if (["pending", "in_process", "in_mediation"].includes(s)) return "confirming";
  if (["cancelled", "rejected"].includes(s)) return "failed";
  // Mercado Pago não tem "expired" explícito — cobranças PIX expiram por tempo
  return "pending";
}
