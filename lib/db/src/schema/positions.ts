import { pgTable, serial, timestamp, numeric, integer, text, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { strategiesTable } from "./strategies";

export const positionStatusEnum = pgEnum("position_status", ["active", "closed"]);

export const userPositionsTable = pgTable("user_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  strategyId: integer("strategy_id").notNull().references(() => strategiesTable.id),
  shares: numeric("shares", { precision: 20, scale: 8 }).notNull(),
  purchasePrice: numeric("purchase_price", { precision: 20, scale: 8 }).notNull(),
  investedAmount: numeric("invested_amount", { precision: 20, scale: 8 }).notNull(),
  currentValue: numeric("current_value", { precision: 20, scale: 8 }).notNull(),
  yieldAmount: numeric("yield_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  yieldPercentage: numeric("yield_percentage", { precision: 10, scale: 4 }).notNull().default("0"),
  status: positionStatusEnum("status").notNull().default("active"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPositionSchema = createInsertSchema(userPositionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type UserPosition = typeof userPositionsTable.$inferSelect;
