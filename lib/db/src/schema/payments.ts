import { pgTable, serial, timestamp, text, boolean, integer, numeric, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { partnersTable } from "./partners";

// ─── Payment providers ────────────────────────────────────────────────────────
export const paymentProviderEnum = pgEnum("payment_provider", ["nowpayments", "mercadopago"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",      // criada, aguardando pagamento
  "confirming",   // pagamento recebido, aguardando confirmação na blockchain
  "confirmed",    // confirmado — saldo creditado + split executado
  "expired",      // expirou sem pagamento
  "failed",       // falhou
]);
export const invoiceReferenceTypeEnum = pgEnum("invoice_reference_type", ["deposit", "position"]);

// ─── Payment invoices (unificado para todos os gateways) ──────────────────────
export const paymentInvoicesTable = pgTable("payment_invoices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

  provider: paymentProviderEnum("provider").notNull(),
  // ID retornado pelo gateway (NowPayments invoice id / Mercado Pago payment id)
  providerInvoiceId: text("provider_invoice_id"),
  providerStatus: text("provider_status"), // status cru do gateway (waiting, confirming, finished, approved, etc.)

  // O que o usuário quer pagar e em que moeda
  amountRequested: numeric("amount_requested", { precision: 20, scale: 8 }).notNull(),
  priceCurrency: text("price_currency").notNull().default("BRL"), // BRL, USD, etc.

  // Moeda/método que o usuário vai usar para pagar
  payCurrency: text("pay_currency"), // btc, usdttrc20, usdtbsc, pix, etc.
  payAmount: numeric("pay_amount", { precision: 20, scale: 8 }),
  payAddress: text("pay_address"), // endereço cripto para onde enviar
  payUrl: text("pay_url"), // URL de pagamento (Mercado Pago) ou invoice URL
  qrCodeUrl: text("qr_code_url"), // QR code (PIX / endereço cripto)

  // Valor efetivamente pago (pode diferir em cripto)
  amountPaid: numeric("amount_paid", { precision: 20, scale: 8 }),

  // O que essa fatura representa (depósito de saldo ou compra de posição)
  referenceType: invoiceReferenceTypeEnum("reference_type").notNull().default("deposit"),
  referenceId: integer("reference_id"), // ex.: deposit.id

  status: invoiceStatusEnum("status").notNull().default("pending"),

  // Payload cru do gateway (para auditoria / debug)
  metadata: jsonb("metadata"),

  expiresAt: timestamp("expires_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Webhook events (idempotência — nunca processa o mesmo evento 2x) ─────────
export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: paymentProviderEnum("provider").notNull(),
  // ID único do evento no gateway (para idempotência)
  eventId: text("event_id").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Partner payouts (saques dos sócios) ──────────────────────────────────────
export const partnerPayoutStatusEnum = pgEnum("partner_payout_status", [
  "pending",              // criado, aguardando processamento
  "awaiting_confirmation", // NowPayments criou o payout, aguarda código 2FA (se aplicável)
  "processing",           // payout aceito/enviado pela NowPayments, aguardando confirmação na rede
  "completed",            // confirmado na rede — dinheiro enviado
  "failed",               // falhou — valor devolvido ao saldo do sócio
  "rejected",
]);

export const partnerPayoutsTable = pgTable("partner_payouts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(), // valor na moeda original (USD)
  usdAmount: numeric("usd_amount", { precision: 20, scale: 8 }).notNull(), // valor em USD
  currency: text("currency").notNull().default("usdtbsc"), // NowPayments payout currency
  method: text("method").notNull().default("nowpayments"), // "nowpayments" (auto) | "pix" | "bank" (manual)
  destination: text("destination"), // carteira cripto / chave PIX / dados bancários
  // ── NowPayments payout ──
  providerPayoutId: text("provider_payout_id"), // NowPayments payout ID
  providerBatchId: text("provider_batch_id"),
  providerStatus: text("provider_status"), // CREATED | PROCESSING | FINISHED | FAILED
  transactionHash: text("transaction_hash"),
  externalId: text("external_id"), // unique_external_id enviado ao NowPayments
  status: partnerPayoutStatusEnum("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  notes: text("notes"),
  processedBy: integer("processed_by").references(() => usersTable.id),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PaymentInvoice = typeof paymentInvoicesTable.$inferSelect;
export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type PartnerPayout = typeof partnerPayoutsTable.$inferSelect;
