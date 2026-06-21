import { Router } from "express";
import { db, usersTable, userPositionsTable, strategiesTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { formatStrategy, formatPosition } from "./strategies";
import { auditLog } from "../lib/audit";

const router = Router();

// GET /positions
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const positions = await db.select().from(userPositionsTable)
      .where(eq(userPositionsTable.userId, req.userId!));
    const strategyIds = [...new Set(positions.map(p => p.strategyId))];
    const strategies = strategyIds.length
      ? await db.select().from(strategiesTable).where(
          strategyIds.length === 1
            ? eq(strategiesTable.id, strategyIds[0])
            : eq(strategiesTable.id, strategyIds[0]) // we'll use map
        )
      : [];
    const stratMap = Object.fromEntries(strategies.map(s => [s.id, s]));
    // Get all strategies properly
    const allStrats = await db.select().from(strategiesTable);
    const allStratMap = Object.fromEntries(allStrats.map(s => [s.id, s]));
    res.json(positions.map(p => formatPosition(p, allStratMap[p.strategyId]?.name ?? "Unknown")));
  } catch (err) {
    req.log.error({ err }, "List positions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /positions (buy cota)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { strategyId, amount } = req.body;
    if (!strategyId || !amount || amount <= 0) {
      res.status(400).json({ error: "Strategy ID and amount are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (Number(user.balance) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));
    if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }
    if (strategy.status !== "active") { res.status(400).json({ error: "Strategy is not active" }); return; }
    if (amount < Number(strategy.minInvestment)) {
      res.status(400).json({ error: `Minimum investment is ${strategy.minInvestment}` });
      return;
    }
    const sharePrice = Number(strategy.sharePrice);
    const shares = amount / sharePrice;

    const balanceBefore = Number(user.balance);
    const balanceAfter = balanceBefore - amount;

    // Update user balance and investment
    await db.update(usersTable).set({
      balance: String(balanceAfter),
      totalInvested: String(Number(user.totalInvested) + amount),
    }).where(eq(usersTable.id, req.userId!));

    // Create position
    const [position] = await db.insert(userPositionsTable).values({
      userId: req.userId!,
      strategyId,
      shares: String(shares),
      purchasePrice: String(sharePrice),
      investedAmount: String(amount),
      currentValue: String(amount),
      yieldAmount: "0",
      yieldPercentage: "0",
      status: "active",
    }).returning();

    // Update strategy
    await db.update(strategiesTable).set({
      availableShares: strategy.availableShares - Math.floor(shares),
      aum: String(Number(strategy.aum) + amount),
    }).where(eq(strategiesTable.id, strategyId));

    // Record transaction
    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "position_buy",
      amount: String(-amount),
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      description: `Compra de ${shares.toFixed(4)} cotas - ${strategy.name}`,
      referenceId: position.id,
      referenceType: "position",
    });

    await auditLog({ userId: req.userId!, action: "buy_position", entityType: "position", entityId: position.id, req });
    res.status(201).json(formatPosition(position, strategy.name));
  } catch (err) {
    req.log.error({ err }, "Buy position error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /positions/summary
router.get("/summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const positions = await db.select().from(userPositionsTable)
      .where(and(eq(userPositionsTable.userId, req.userId!), eq(userPositionsTable.status, "active")));
    const allStrats = await db.select().from(strategiesTable);
    const stratMap = Object.fromEntries(allStrats.map(s => [s.id, s]));

    const totalInvested = positions.reduce((a, p) => a + Number(p.investedAmount), 0);
    const totalCurrentValue = positions.reduce((a, p) => a + Number(p.currentValue), 0);
    const totalYield = positions.reduce((a, p) => a + Number(p.yieldAmount), 0);

    res.json({
      totalInvested,
      totalCurrentValue,
      totalYield,
      totalYieldPercentage: totalInvested > 0 ? (totalYield / totalInvested) * 100 : 0,
      byStrategy: positions.map(p => formatPosition(p, stratMap[p.strategyId]?.name ?? "Unknown")),
    });
  } catch (err) {
    req.log.error({ err }, "Positions summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /positions/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [position] = await db.select().from(userPositionsTable)
      .where(and(eq(userPositionsTable.id, id), eq(userPositionsTable.userId, req.userId!)));
    if (!position) { res.status(404).json({ error: "Position not found" }); return; }
    const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, position.strategyId));
    res.json(formatPosition(position, strategy?.name ?? "Unknown"));
  } catch (err) {
    req.log.error({ err }, "Get position error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
