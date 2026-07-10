import { pgTable, serial, timestamp, numeric, integer, text, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const paymentMethodEnum = pgEnum("payment_method", ["pix", "usdt_bep20", "bitcoin", "usdc", "bnb"]);
export const depositStatusEnum = pgEnum("deposit_status", ["pending", "confirmed", "failed", "cancelled"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "processing", "completed", "rejected"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "position_buy", "yield_credit", "commission", "adjustment"]);
export const commissionStatusEnum = pgEnum("commission_status", ["pending", "paid"]);

export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  status: depositStatusEnum("status").notNull().default("pending"),
  walletAddress: text("wallet_address"),
  transactionHash: text("transaction_hash"),
  qrCodeUrl: text("qr_code_url"),
  notes: text("notes"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: integer("confirmed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 20, scale: 8 }).notNull(),
  walletAddress: text("wallet_address").notNull(),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  transactionHash: text("transaction_hash"),
  rejectionReason: text("rejection_reason"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processedBy: integer("processed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 20, scale: 8 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 20, scale: 8 }).notNull(),
  description: text("description").notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id),
  referredId: integer("referred_id").notNull().references(() => usersTable.id),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  rate: numeric("rate", { precision: 10, scale: 4 }).notNull(),
  level: integer("level").notNull().default(1),
  status: commissionStatusEnum("status").notNull().default("pending"),
  referenceId: integer("reference_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Deposit = typeof depositsTable.$inferSelect;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
