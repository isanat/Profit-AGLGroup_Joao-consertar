import { Router } from "express";
import { db, depositsTable, usersTable, transactionsTable, platformWalletsTable, commissionsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { auditLog } from "../lib/audit";
import { getSetting } from "../lib/settings";

const router = Router();

// GET /deposits/methods
router.get("/methods", requireAuth, async (req: AuthRequest, res) => {
  try {
    const wallets = await db.select().from(platformWalletsTable).where(eq(platformWalletsTable.isActive, true));
    res.json(wallets.map(w => ({
      method: w.method,
      label: w.label,
      walletAddress: w.address,
      qrCodeUrl: null,
      instructions: w.instructions,
      minAmount: 10,
      isActive: w.isActive,
    })));
  } catch (err) {
    req.log.error({ err }, "Deposit methods error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /deposits
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, method } = req.query;
    const deposits = await db.select().from(depositsTable)
      .where(eq(depositsTable.userId, req.userId!))
      .orderBy(desc(depositsTable.createdAt));
    const filtered = deposits.filter(d => {
      if (status && d.status !== status) return false;
      if (method && d.method !== method) return false;
      return true;
    });
    res.json(filtered.map(formatDeposit));
  } catch (err) {
    req.log.error({ err }, "List deposits error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /deposits
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { method, amount } = req.body;
    if (!method || !amount || amount <= 0) {
      res.status(400).json({ error: "Method and amount are required" });
      return;
    }
    const [wallet] = await db.select().from(platformWalletsTable)
      .where(and(eq(platformWalletsTable.method, method), eq(platformWalletsTable.isActive, true)));

    const [deposit] = await db.insert(depositsTable).values({
      userId: req.userId!,
      method,
      amount: String(amount),
      status: "pending",
      walletAddress: wallet?.address ?? null,
    }).returning();

    await auditLog({ userId: req.userId!, action: "create_deposit", entityType: "deposit", entityId: deposit.id, req });
    res.status(201).json(formatDeposit(deposit));
  } catch (err) {
    req.log.error({ err }, "Create deposit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /deposits/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deposit] = await db.select().from(depositsTable)
      .where(and(eq(depositsTable.id, id), eq(depositsTable.userId, req.userId!)));
    if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
    res.json(formatDeposit(deposit));
  } catch (err) {
    req.log.error({ err }, "Get deposit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Confirm deposit (called by admin route) ──────────────────────────────────

export async function confirmDeposit(
  depositId: number,
  adminUserId: number,
  status: string,
  txHash?: string,
  notes?: string,
) {
  const [deposit] = await db.select().from(depositsTable).where(eq(depositsTable.id, depositId));
  if (!deposit) throw new Error("Deposit not found");

  await db.update(depositsTable).set({
    status: status as "confirmed" | "failed" | "cancelled",
    transactionHash: txHash ?? null,
    notes: notes ?? null,
    confirmedAt: status === "confirmed" ? new Date() : null,
    confirmedBy: adminUserId,
  }).where(eq(depositsTable.id, depositId));

  if (status === "confirmed") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
    if (user) {
      // Credit depositor balance
      const balanceBefore = Number(user.balance);
      const balanceAfter = balanceBefore + Number(deposit.amount);
      await db.update(usersTable).set({ balance: String(balanceAfter) }).where(eq(usersTable.id, user.id));
      await db.insert(transactionsTable).values({
        userId: user.id,
        type: "deposit",
        amount: deposit.amount,
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        description: `Depósito confirmado via ${deposit.method}`,
        referenceId: deposit.id,
        referenceType: "deposit",
      });

      // ── Referral commission ────────────────────────────────────────────────
      if (user.referredBy) {
        // Anti-duplicate: one commission per deposit
        const [existingCommission] = await db
          .select({ id: commissionsTable.id })
          .from(commissionsTable)
          .where(
            and(
              eq(commissionsTable.fromUserId, user.id),
              eq(commissionsTable.referenceId, deposit.id),
            ),
          )
          .limit(1);

        if (!existingCommission) {
          const commissionRate = Number(await getSetting("referralCommissionPercent")) || 5;
          const depositAmount = Number(deposit.amount);
          const commissionAmount = parseFloat((depositAmount * commissionRate / 100).toFixed(8));

          const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, user.referredBy));
          if (referrer) {
            const referrerBalanceBefore = Number(referrer.balance);
            const referrerBalanceAfter = referrerBalanceBefore + commissionAmount;

            // Credit referrer balance
            await db.update(usersTable)
              .set({ balance: String(referrerBalanceAfter) })
              .where(eq(usersTable.id, referrer.id));

            // Record commission (paid immediately on deposit approval)
            await db.insert(commissionsTable).values({
              userId: referrer.id,
              fromUserId: user.id,
              amount: String(commissionAmount),
              rate: String(commissionRate),
              level: 1,
              status: "paid",
              referenceId: deposit.id,
              paidAt: new Date(),
            });

            // Record transaction for referrer
            await db.insert(transactionsTable).values({
              userId: referrer.id,
              type: "commission",
              amount: String(commissionAmount),
              balanceBefore: String(referrerBalanceBefore),
              balanceAfter: String(referrerBalanceAfter),
              description: `Bônus de indicação — depósito de ${user.name} aprovado (R$ ${depositAmount.toFixed(2)})`,
              referenceId: deposit.id,
              referenceType: "deposit",
            });

            // Notify referrer
            await db.insert(notificationsTable).values({
              userId: referrer.id,
              title: "Bônus de indicação creditado",
              message: `R$ ${commissionAmount.toFixed(2)} de bônus de indicação foram creditados pelo depósito aprovado de ${user.name}.`,
              type: "success",
            });
          }
        }
      }
    }
  }

  const [updated] = await db.select().from(depositsTable).where(eq(depositsTable.id, depositId));
  return updated;
}

function formatDeposit(d: typeof depositsTable.$inferSelect) {
  return {
    id: d.id, userId: d.userId, method: d.method, amount: Number(d.amount),
    status: d.status, walletAddress: d.walletAddress, transactionHash: d.transactionHash,
    qrCodeUrl: d.qrCodeUrl, confirmedAt: d.confirmedAt, createdAt: d.createdAt,
  };
}

export { formatDeposit };
export default router;
