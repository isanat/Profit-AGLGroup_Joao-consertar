import { pgTable, serial, timestamp, text, boolean, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── Partners (sócios da plataforma que recebem % de cada pagamento) ──────────
export const partnerStatusEnum = pgEnum("partner_status", ["active", "inactive"]);

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  document: text("document"), // CPF/CNPJ
  // Split percentual — % que esse sócio recebe de cada pagamento confirmado via gateway
  splitPercent: numeric("split_percent", { precision: 10, scale: 4 }).notNull().default("0"),
  // Dados para payout (sacar)
  payoutMethod: text("payout_method"), // "pix" | "crypto" | "bank"
  pixKey: text("pix_key"),
  pixKeyType: text("pix_key_type"),
  cryptoWallet: text("crypto_wallet"),
  bankInfo: text("bank_info"), // JSON string com {bank, agency, account, type}
  // Saldo acumulado (creditado pelo split engine, abatido quando admin marca payout)
  balanceDue: numeric("balance_due", { precision: 20, scale: 8 }).notNull().default("0"),
  totalEarned: numeric("total_earned", { precision: 20, scale: 8 }).notNull().default("0"),
  totalPaid: numeric("total_paid", { precision: 20, scale: 8 }).notNull().default("0"),
  notes: text("notes"),
  status: partnerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Partner splits (cada distribuição individual registrada) ─────────────────
export const partnerSplitStatusEnum = pgEnum("partner_split_status", ["credited", "paid", "cancelled"]);

export const partnerSplitsTable = pgTable("partner_splits", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  paymentInvoiceId: integer("payment_invoice_id"),
  userId: integer("user_id").references(() => usersTable.id), // usuário que originou o pagamento
  baseAmount: numeric("base_amount", { precision: 20, scale: 8 }).notNull(),
  splitPercent: numeric("split_percent", { precision: 10, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  status: partnerSplitStatusEnum("status").notNull().default("credited"),
  description: text("description"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Partner = typeof partnersTable.$inferSelect;
export type PartnerSplit = typeof partnerSplitsTable.$inferSelect;
