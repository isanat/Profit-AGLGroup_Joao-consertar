import { pgTable, serial, timestamp, numeric, integer, text, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { userPositionsTable } from "./positions";

export const dailyProfitSettingsTable = pgTable("daily_profit_settings", {
  id: serial("id").primaryKey(),
  percentage: numeric("percentage", { precision: 10, scale: 4 }).notNull().default("1"),
  executionTime: text("execution_time").notNull().default("18:00"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const dailyProfitDaysTable = pgTable("daily_profit_days", {
  id: serial("id").primaryKey(),
  settingId: integer("setting_id")
    .notNull()
    .references(() => dailyProfitSettingsTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Mon, ..., 6=Sat
});

export const dailyProfitHistoryTable = pgTable(
  "daily_profit_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    investmentId: integer("investment_id")
      .notNull()
      .references(() => userPositionsTable.id, { onDelete: "cascade" }),
    percentage: numeric("percentage", { precision: 10, scale: 4 }).notNull(),
    investmentAmount: numeric("investment_amount", { precision: 20, scale: 8 }).notNull(),
    profitAmount: numeric("profit_amount", { precision: 20, scale: 8 }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_dph_user_id").on(t.userId),
    index("idx_dph_executed_at").on(t.executedAt),
    index("idx_dph_investment_id").on(t.investmentId),
  ],
);

export type DailyProfitSettings = typeof dailyProfitSettingsTable.$inferSelect;
export type DailyProfitDay = typeof dailyProfitDaysTable.$inferSelect;
export type DailyProfitHistory = typeof dailyProfitHistoryTable.$inferSelect;
