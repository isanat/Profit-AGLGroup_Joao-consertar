import { Router } from "express";
import { db, dailyProfitSettingsTable, dailyProfitDaysTable, dailyProfitHistoryTable, userPositionsTable, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, sql, gte, lte, inArray } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAdmin);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the current settings row (creates default if none exists) */
async function getOrCreateSettings() {
  const [existing] = await db
    .select()
    .from(dailyProfitSettingsTable)
    .orderBy(dailyProfitSettingsTable.id)
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(dailyProfitSettingsTable)
    .values({ percentage: "1", executionTime: "18:00", active: true })
    .returning();

  return created;
}

// ─── Core execution logic ──────────────────────────────────────────────────────

export interface ExecuteResult {
  processed: number;
  skipped: number;
  errors: number;
  totalProfit: number;
  duration: number;
  isManual: boolean;
}

export async function executeDailyProfit(opts: { isManual: boolean }): Promise<ExecuteResult> {
  const startTime = Date.now();
  const now = new Date();

  const settings = await getOrCreateSettings();

  if (!settings.active && !opts.isManual) {
    logger.info("Daily profit: skipped — settings inactive");
    return { processed: 0, skipped: 0, errors: 0, totalProfit: 0, duration: 0, isManual: opts.isManual };
  }

  // AUTOMATED EXECUTION (not manual):
  // Instead of requiring an EXACT minute match (which breaks if the server restarts
  // or is busy at that moment), we use a "daily window" approach:
  //  - Determine today's target execution time (HH:MM in server timezone)
  //  - If we're PAST that time today AND we haven't run today → execute now
  //  - The duplicate guard (by UTC day) ensures we never run twice in one day
  if (!opts.isManual) {
    // Check selected day of week
    const days = await db
      .select()
      .from(dailyProfitDaysTable)
      .where(eq(dailyProfitDaysTable.settingId, settings.id));

    const todayDow = now.getDay(); // 0=Sun..6=Sat
    // Default: if no days configured, run EVERY day (auto-friendly)
    const isSelectedDay = days.length === 0 ? true : days.some((d) => d.dayOfWeek === todayDow);
    if (!isSelectedDay) {
      return { processed: 0, skipped: 0, errors: 0, totalProfit: 0, duration: 0, isManual: false };
    }

    // Time window check: have we passed today's execution time?
    const [configHour, configMin] = settings.executionTime.split(":").map(Number);
    const targetToday = new Date(now);
    targetToday.setHours(configHour, configMin, 0, 0);
    if (now < targetToday) {
      // Not yet time today
      return { processed: 0, skipped: 0, errors: 0, totalProfit: 0, duration: 0, isManual: false };
    }
    // If we're past target time, proceed — the duplicate guard below prevents double execution
  }

  const globalPercentage = Number(settings.percentage);
  logger.info({ globalPercentage, isManual: opts.isManual }, "Daily profit: starting execution");

  // Fetch all active positions + their strategies (to use per-strategy dailyProfitPercent)
  const positions = await db
    .select()
    .from(userPositionsTable)
    .where(eq(userPositionsTable.status, "active"));

  // Fetch strategies for per-strategy percentage
  const { strategiesTable } = await import("@workspace/db");
  const allStrategies = await db.select().from(strategiesTable);
  const stratMap = Object.fromEntries(allStrategies.map((s) => [s.id, s]));

  // Get the date boundary for duplicate check (UTC day)
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(23, 59, 59, 999);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalProfit = 0;

  for (const pos of positions) {
    try {
      // Duplicate guard: has this position already received profit today?
      const [existing] = await db
        .select({ id: dailyProfitHistoryTable.id })
        .from(dailyProfitHistoryTable)
        .where(
          and(
            eq(dailyProfitHistoryTable.investmentId, pos.id),
            gte(dailyProfitHistoryTable.executedAt, dayStart),
            lte(dailyProfitHistoryTable.executedAt, dayEnd),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      // Use the strategy's dailyProfitPercent if > 0, otherwise fall back to global
      const strategy = stratMap[pos.strategyId];
      const stratDailyPct = strategy ? Number(strategy.dailyProfitPercent) : 0;
      const percentage = stratDailyPct > 0 ? stratDailyPct : globalPercentage;
      if (percentage <= 0) {
        skipped++;
        continue;
      }

      const investedAmount = Number(pos.investedAmount);
      const profit = parseFloat((investedAmount * (percentage / 100)).toFixed(8));
      if (profit <= 0) {
        skipped++;
        continue;
      }

      // Fetch current user balance for transaction record
      const [userRow] = await db
        .select({ balance: usersTable.balance })
        .from(usersTable)
        .where(eq(usersTable.id, pos.userId))
        .limit(1);

      const balanceBefore = Number(userRow?.balance ?? 0);
      const balanceAfter = parseFloat((balanceBefore + profit).toFixed(8));

      // Record history
      await db.insert(dailyProfitHistoryTable).values({
        userId: pos.userId,
        investmentId: pos.id,
        percentage: String(percentage),
        investmentAmount: String(investedAmount),
        profitAmount: String(profit),
        executedAt: now,
      });

      // Credit user balance and update totalYield
      await db
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${String(profit)}`,
          totalYield: sql`${usersTable.totalYield} + ${String(profit)}`,
        })
        .where(eq(usersTable.id, pos.userId));

      // Update position yield
      await db
        .update(userPositionsTable)
        .set({
          yieldAmount: sql`${userPositionsTable.yieldAmount} + ${String(profit)}`,
          currentValue: sql`${userPositionsTable.currentValue} + ${String(profit)}`,
        })
        .where(eq(userPositionsTable.id, pos.id));

      // Record transaction
      await db.insert(transactionsTable).values({
        userId: pos.userId,
        type: "yield_credit",
        amount: String(profit),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        description: `Rendimento diário de ${percentage}% — ${strategy?.name ?? `posição #${pos.id}`}`,
      });

      // Notify user
      await db.insert(notificationsTable).values({
        userId: pos.userId,
        title: "Rendimento creditado",
        message: `R$ ${profit.toFixed(2)} de rendimento diário (${percentage}%) foram creditados na sua carteira.`,
        type: "success",
      });

      totalProfit += profit;
      processed++;
    } catch (err) {
      errors++;
      logger.error({ err, positionId: pos.id }, "Daily profit: error processing position");
    }
  }

  const duration = Date.now() - startTime;
  logger.info({ processed, skipped, errors, totalProfit, duration }, "Daily profit: execution complete");

  return { processed, skipped, errors, totalProfit, duration, isManual: opts.isManual };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /admin/daily-profit/settings
router.get("/settings", async (req: AuthRequest, res) => {
  try {
    const settings = await getOrCreateSettings();
    const days = await db
      .select()
      .from(dailyProfitDaysTable)
      .where(eq(dailyProfitDaysTable.settingId, settings.id));

    res.json({
      id: settings.id,
      percentage: Number(settings.percentage),
      executionTime: settings.executionTime,
      active: settings.active,
      days: days.map((d) => d.dayOfWeek),
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Daily profit get settings error");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /admin/daily-profit/settings
router.post("/settings", async (req: AuthRequest, res) => {
  try {
    const { percentage, executionTime, active, days } = req.body as {
      percentage: number;
      executionTime?: string;
      active?: boolean;
      days?: number[];
    };

    if (!percentage || percentage < 0.01 || percentage > 100) {
      res.status(400).json({ error: "Percentual deve ser entre 0.01 e 100" });
      return;
    }

    const existingSettings = await getOrCreateSettings();

    const [updated] = await db
      .update(dailyProfitSettingsTable)
      .set({
        percentage: String(percentage),
        executionTime: executionTime ?? existingSettings.executionTime,
        active: active !== undefined ? active : existingSettings.active,
      })
      .where(eq(dailyProfitSettingsTable.id, existingSettings.id))
      .returning();

    // Replace days
    if (Array.isArray(days)) {
      await db
        .delete(dailyProfitDaysTable)
        .where(eq(dailyProfitDaysTable.settingId, updated.id));

      if (days.length > 0) {
        await db.insert(dailyProfitDaysTable).values(
          days.map((dow) => ({ settingId: updated.id, dayOfWeek: dow })),
        );
      }
    }

    const savedDays = await db
      .select()
      .from(dailyProfitDaysTable)
      .where(eq(dailyProfitDaysTable.settingId, updated.id));

    res.json({
      id: updated.id,
      percentage: Number(updated.percentage),
      executionTime: updated.executionTime,
      active: updated.active,
      days: savedDays.map((d) => d.dayOfWeek),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Daily profit save settings error");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /admin/daily-profit/execute
router.post("/execute", async (req: AuthRequest, res) => {
  try {
    const result = await executeDailyProfit({ isManual: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Daily profit manual execute error");
    res.status(500).json({ error: "Erro ao executar distribuição" });
  }
});

// GET /admin/daily-profit/history
router.get("/history", async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20", dateFrom, dateTo } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // Aggregate history by executedAt day
    const allHistory = await db
      .select({
        id: dailyProfitHistoryTable.id,
        userId: dailyProfitHistoryTable.userId,
        investmentId: dailyProfitHistoryTable.investmentId,
        percentage: dailyProfitHistoryTable.percentage,
        investmentAmount: dailyProfitHistoryTable.investmentAmount,
        profitAmount: dailyProfitHistoryTable.profitAmount,
        executedAt: dailyProfitHistoryTable.executedAt,
        createdAt: dailyProfitHistoryTable.createdAt,
      })
      .from(dailyProfitHistoryTable)
      .orderBy(desc(dailyProfitHistoryTable.executedAt));

    // Group by executedAt date (day)
    type GroupEntry = {
      date: string;
      percentage: number;
      usersCount: number;
      totalProfit: number;
      entries: typeof allHistory;
    };
    const groups: Map<string, GroupEntry> = new Map();

    for (const h of allHistory) {
      const dateStr = new Date(h.executedAt).toISOString().slice(0, 10);

      // Date filter
      if (dateFrom && dateStr < dateFrom) continue;
      if (dateTo && dateStr > dateTo) continue;

      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: dateStr,
          percentage: Number(h.percentage),
          usersCount: 0,
          totalProfit: 0,
          entries: [],
        });
      }
      const g = groups.get(dateStr)!;
      g.usersCount++;
      g.totalProfit += Number(h.profitAmount);
      g.entries.push(h);
    }

    const sorted = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
    const total = sorted.length;
    const paginated = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      data: paginated.map((g) => ({
        date: g.date,
        percentage: g.percentage,
        usersCount: g.usersCount,
        totalProfit: parseFloat(g.totalProfit.toFixed(8)),
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Daily profit history error");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
