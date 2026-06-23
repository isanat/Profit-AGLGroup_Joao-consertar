import { Router } from "express";
import { db, withdrawalsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getSetting } from "../lib/settings";
import { auditLog } from "../lib/audit";

const router = Router();

// GET /withdrawals/fee-info — returns current fee settings for display in UI
router.get("/fee-info", requireAuth, async (req: AuthRequest, res) => {
  try {
    const feePercent = Number(await getSetting("withdrawalFeePercent")) || 2;
    const minWithdrawal = Number(await getSetting("minWithdrawal")) || 10;
    const maxWithdrawal = Number(await getSetting("maxWithdrawal")) || 100000;
    res.json({ feePercent, minWithdrawal, maxWithdrawal });
  } catch (err) {
    req.log.error({ err }, "Get withdrawal fee info error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /withdrawals
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const withdrawals = await db.select().from(withdrawalsTable)
      .where(eq(withdrawalsTable.userId, req.userId!))
      .orderBy(desc(withdrawalsTable.createdAt));
    const filtered = status ? withdrawals.filter(w => w.status === status) : withdrawals;
    res.json(filtered.map(formatWithdrawal));
  } catch (err) {
    req.log.error({ err }, "List withdrawals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /withdrawals
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount, method, walletAddress } = req.body;
    if (!amount || !method || !walletAddress) {
      res.status(400).json({ error: "Amount, method, and wallet address are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (Number(user.balance) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    const feePercent = Number(await getSetting("withdrawalFeePercent")) || 2;
    const fee = (amount * feePercent) / 100;
    const netAmount = amount - fee;

    const balanceBefore = Number(user.balance);
    const balanceAfter = balanceBefore - amount;

    await db.update(usersTable).set({ balance: String(balanceAfter) }).where(eq(usersTable.id, req.userId!));

    const [withdrawal] = await db.insert(withdrawalsTable).values({
      userId: req.userId!,
      method,
      amount: String(amount),
      fee: String(fee),
      netAmount: String(netAmount),
      walletAddress,
      status: "pending",
    }).returning();

    await db.insert(transactionsTable).values({
      userId: req.userId!,
      type: "withdrawal",
      amount: String(-amount),
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      description: `Solicitação de saque via ${method}`,
      referenceId: withdrawal.id,
      referenceType: "withdrawal",
    });

    await auditLog({ userId: req.userId!, action: "request_withdrawal", entityType: "withdrawal", entityId: withdrawal.id, req });
    res.status(201).json(formatWithdrawal(withdrawal));
  } catch (err) {
    req.log.error({ err }, "Request withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /withdrawals/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [withdrawal] = await db.select().from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.userId, req.userId!)));
    if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
    res.json(formatWithdrawal(withdrawal));
  } catch (err) {
    req.log.error({ err }, "Get withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export async function approveWithdrawal(withdrawalId: number, action: string, txHash?: string, reason?: string) {
  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId));
  if (!withdrawal) throw new Error("Withdrawal not found");

  if (action === "approve") {
    await db.update(withdrawalsTable).set({
      status: "completed",
      transactionHash: txHash ?? null,
      processedAt: new Date(),
    }).where(eq(withdrawalsTable.id, withdrawalId));
  } else {
    // Reject: refund the balance
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));
    if (user) {
      const refundAmount = Number(withdrawal.amount);
      const newBalance = Number(user.balance) + refundAmount;
      await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, user.id));
    }
    await db.update(withdrawalsTable).set({
      status: "rejected",
      rejectionReason: reason ?? null,
      processedAt: new Date(),
    }).where(eq(withdrawalsTable.id, withdrawalId));
  }

  const [updated] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawalId));
  return updated;
}

function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  return {
    id: w.id, userId: w.userId, method: w.method,
    amount: Number(w.amount), fee: Number(w.fee), netAmount: Number(w.netAmount),
    walletAddress: w.walletAddress, status: w.status,
    transactionHash: w.transactionHash, rejectionReason: w.rejectionReason,
    processedAt: w.processedAt, createdAt: w.createdAt,
  };
}

export { formatWithdrawal };
export default router;
