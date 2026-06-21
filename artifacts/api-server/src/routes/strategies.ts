import { Router } from "express";
import { db, strategiesTable, strategyPerformanceTable, userPositionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /strategies
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    let query = db.select().from(strategiesTable);
    const strategies = await query;
    const { status, riskLevel, category } = req.query;
    const filtered = strategies.filter(s => {
      if (status && s.status !== status) return false;
      if (riskLevel && s.riskLevel !== riskLevel) return false;
      if (category && s.category !== category) return false;
      return true;
    });
    res.json(filtered.map(formatStrategy));
  } catch (err) {
    req.log.error({ err }, "List strategies error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /strategies/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, id));
    if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

    const performance = await db.select().from(strategyPerformanceTable)
      .where(eq(strategyPerformanceTable.strategyId, id))
      .orderBy(strategyPerformanceTable.date);

    const [userPos] = req.userId
      ? await db.select().from(userPositionsTable).where(
          and(eq(userPositionsTable.userId, req.userId), eq(userPositionsTable.strategyId, id), eq(userPositionsTable.status, "active"))
        )
      : [undefined];

    res.json({
      ...formatStrategy(strategy),
      performanceHistory: performance.map(p => ({
        date: p.date,
        value: Number(p.value),
        yield: Number(p.yieldAmount),
        yieldPercentage: Number(p.yieldPercentage),
      })),
      userPosition: userPos ? formatPosition(userPos, strategy.name) : null,
    });
  } catch (err) {
    req.log.error({ err }, "Get strategy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /strategies/:id/performance
router.get("/:id/performance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const perf = await db.select().from(strategyPerformanceTable)
      .where(eq(strategyPerformanceTable.strategyId, id))
      .orderBy(strategyPerformanceTable.date);

    res.json(perf.map(p => ({
      date: p.date,
      value: Number(p.value),
      yield: Number(p.yieldAmount),
      yieldPercentage: Number(p.yieldPercentage),
    })));
  } catch (err) {
    req.log.error({ err }, "Strategy performance error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export function formatStrategy(s: typeof strategiesTable.$inferSelect) {
  return {
    id: s.id, name: s.name, description: s.description,
    riskLevel: s.riskLevel, category: s.category,
    minInvestment: Number(s.minInvestment),
    totalShares: s.totalShares, availableShares: s.availableShares,
    sharePrice: Number(s.sharePrice), aum: Number(s.aum),
    maxDrawdown: Number(s.maxDrawdown),
    totalReturnPct: Number(s.totalReturnPct),
    monthlyReturnPct: Number(s.monthlyReturnPct),
    status: s.status, startDate: s.startDate, createdAt: s.createdAt,
  };
}

export function formatPosition(p: typeof userPositionsTable.$inferSelect, strategyName: string) {
  return {
    id: p.id, userId: p.userId, strategyId: p.strategyId, strategyName,
    shares: Number(p.shares), purchasePrice: Number(p.purchasePrice),
    currentValue: Number(p.currentValue), investedAmount: Number(p.investedAmount),
    yieldAmount: Number(p.yieldAmount), yieldPercentage: Number(p.yieldPercentage),
    status: p.status, purchasedAt: p.purchasedAt,
  };
}

export default router;
