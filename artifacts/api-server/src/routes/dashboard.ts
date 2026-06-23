import { Router } from "express";
import { db, usersTable, userPositionsTable, depositsTable, withdrawalsTable, referralsTable, commissionsTable, transactionsTable, strategyPerformanceTable, strategiesTable } from "@workspace/db";
import { eq, and, sum, count, desc, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /dashboard/summary
router.get("/summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "Not found" }); return; }

    const positions = await db.select().from(userPositionsTable)
      .where(and(eq(userPositionsTable.userId, req.userId!), eq(userPositionsTable.status, "active")));

    const allDeposits = await db.select().from(depositsTable)
      .where(eq(depositsTable.userId, req.userId!));

    const allWithdrawals = await db.select().from(withdrawalsTable)
      .where(eq(withdrawalsTable.userId, req.userId!));

    const referralRows = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.userId!));

    const commissions = await db.select().from(commissionsTable)
      .where(and(eq(commissionsTable.userId, req.userId!), eq(commissionsTable.status, "paid")));

    const totalShares = positions.reduce((acc, p) => acc + Number(p.shares), 0);
    const commissionEarned = commissions.reduce((acc, c) => acc + Number(c.amount), 0);

    const totalDeposited = allDeposits
      .filter(d => d.status === "confirmed")
      .reduce((a, d) => a + Number(d.amount), 0);

    const totalWithdrawn = allWithdrawals
      .filter(w => w.status === "completed" || w.status === "approved")
      .reduce((a, w) => a + Number(w.netAmount), 0);

    const pendingDeposits = allDeposits
      .filter(d => d.status === "pending")
      .reduce((a, d) => a + Number(d.amount), 0);

    const pendingWithdrawals = allWithdrawals
      .filter(w => w.status === "pending")
      .reduce((a, w) => a + Number(w.amount), 0);

    res.json({
      balance: Number(user.balance),
      totalInvested: Number(user.totalInvested),
      totalYield: Number(user.totalYield),
      yieldPercentage: Number(user.totalInvested) > 0
        ? (Number(user.totalYield) / Number(user.totalInvested)) * 100 : 0,
      activePositions: positions.length,
      totalShares,
      totalDeposited,
      totalWithdrawn,
      pendingDeposits,
      pendingWithdrawals,
      referralCount: referralRows.length,
      commissionEarned,
      referralCode: user.referralCode,
      userName: user.name,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/performance
router.get("/performance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || "30d";
    const positions = await db.select().from(userPositionsTable)
      .where(and(eq(userPositionsTable.userId, req.userId!), eq(userPositionsTable.status, "active")));

    // Generate synthetic performance data based on user's positions
    const now = new Date();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 180;
    const points = [];
    const baseValue = positions.reduce((a, p) => a + Number(p.investedAmount), 0) || 1000;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const growth = (days - i) / days * (Math.random() * 0.15 + 0.05);
      const value = baseValue * (1 + growth);
      points.push({
        date: date.toISOString().slice(0, 10),
        value: Math.round(value * 100) / 100,
        yield: Math.round((value - baseValue) * 100) / 100,
        yieldPercentage: Math.round(growth * 10000) / 100,
      });
    }
    res.json(points);
  } catch (err) {
    req.log.error({ err }, "Dashboard performance error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/recent-activity
router.get("/recent-activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const txs = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, req.userId!))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    res.json(txs.map(t => ({
      id: t.id,
      type: t.type,
      description: t.description,
      amount: Number(t.amount),
      createdAt: t.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
