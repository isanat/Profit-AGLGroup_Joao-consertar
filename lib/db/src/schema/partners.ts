import { pgTable, serial, timestamp, text, boolean, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── Partners (sócios da plataforma que recebem % de cada pagamento) ──────────
// Modelo ZyxCompany: acumula em USD, auto-paga via NowPayments quando atinge minPayout.
export const partnerStatusEnum = pgEnum("partner_status", ["active", "inactive"]);

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"), // "dev" | "operations" | "investor" | "partner" | ...
  document: text("document"), // CPF/CNPJ
  // Split percentual — % que esse sócio recebe de cada pagamento confirmado via gateway
  splitPercent: numeric("split_percent", { precision: 10, scale: 4 }).notNull().default("0"),
  // ── Payout via NowPayments (auto) ──
  payoutWallet: text("payout_wallet"), // endereço da carteira cripto (ex.: BSC)
  payoutCurrency: text("payout_currency").notNull().default("usdtbsc"), // NowPayments currency code
  minPayout: numeric("min_payout", { precision: 20, scale: 8 }).notNull().default("10"), // USD mínimo p/ auto-payout
  autoPayout: boolean("auto_payout").notNull().default(true),
  // ── Dados legados para payout manual (PIX/bank) ──
  payoutMethod: text("payout_method"), // "pix" | "crypto" | "bank"
  pixKey: text("pix_key"),
  pixKeyType: text("pix_key_type"),
  cryptoWallet: text("crypto_wallet"),
  bankInfo: text("bank_info"),
  // ── Saldos em USD ──
  // balanceDue = acumulado disponível para próximo payout (em USD)
  balanceDue: numeric("balance_due", { precision: 20, scale: 8 }).notNull().default("0"),
  // pendingPayout = valor em processamento (payout criado mas não finalizado) — em USD
  pendingPayout: numeric("pending_payout", { precision: 20, scale: 8 }).notNull().default("0"),
  totalEarned: numeric("total_earned", { precision: 20, scale: 8 }).notNull().default("0"), // total acumulado (USD)
  totalPaid: numeric("total_paid", { precision: 20, scale: 8 }).notNull().default("0"), // total enviado (USD)
  notes: text("notes"),
  status: partnerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Partner splits (cada distribuição individual registrada — SplitLog) ──────
export const partnerSplitStatusEnum = pgEnum("partner_split_status", ["credited", "processing", "paid", "cancelled"]);

export const partnerSplitsTable = pgTable("partner_splits", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  paymentInvoiceId: integer("payment_invoice_id"),
  userId: integer("user_id").references(() => usersTable.id), // usuário que originou o pagamento
  baseAmount: numeric("base_amount", { precision: 20, scale: 8 }).notNull(), // valor do depósito (moeda original)
  baseCurrency: text("base_currency"), // "BRL" | "USD" | etc.
  amountUsd: numeric("amount_usd", { precision: 20, scale: 8 }).notNull(), // valor do split em USD
  splitPercent: numeric("split_percent", { precision: 10, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(), // valor na moeda original (= baseAmount × pct)
  status: partnerSplitStatusEnum("status").notNull().default("credited"), // credited → processing → paid
  payoutId: integer("payout_id"), // FK para partner_payouts (quando incluído num payout)
  description: text("description"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Partner = typeof partnersTable.$inferSelect;
export type PartnerSplit = typeof partnerSplitsTable.$inferSelect;
