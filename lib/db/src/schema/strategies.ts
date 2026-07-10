import { pgTable, text, serial, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const strategyStatusEnum = pgEnum("strategy_status", ["active", "paused", "closed"]);

export const strategiesTable = pgTable("strategies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull().default("medium"),
  category: text("category").notNull(),
  minInvestment: numeric("min_investment", { precision: 20, scale: 8 }).notNull().default("100"),
  totalShares: integer("total_shares").notNull().default(1000),
  availableShares: integer("available_shares").notNull().default(1000),
  sharePrice: numeric("share_price", { precision: 20, scale: 8 }).notNull().default("100"),
  aum: numeric("aum", { precision: 20, scale: 8 }).notNull().default("0"),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }).notNull().default("0"),
  totalReturnPct: numeric("total_return_pct", { precision: 10, scale: 4 }).notNull().default("0"),
  monthlyReturnPct: numeric("monthly_return_pct", { precision: 10, scale: 4 }).notNull().default("0"),
  dailyProfitPercent: numeric("daily_profit_percent", { precision: 10, scale: 4 }).notNull().default("0"),
  maxReturnPct: numeric("max_return_pct", { precision: 10, scale: 4 }).notNull().default("200"),
  durationDays: integer("duration_days").notNull().default(90),
  status: strategyStatusEnum("status").notNull().default("active"),
  startDate: text("start_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const strategyPerformanceTable = pgTable("strategy_performance", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull().references(() => strategiesTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  value: numeric("value", { precision: 20, scale: 8 }).notNull(),
  yieldAmount: numeric("yield_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  yieldPercentage: numeric("yield_percentage", { precision: 10, scale: 4 }).notNull().default("0"),
  description: text("description"),
  appliedBy: integer("applied_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStrategySchema = createInsertSchema(strategiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategiesTable.$inferSelect;
export type StrategyPerformance = typeof strategyPerformanceTable.$inferSelect;
