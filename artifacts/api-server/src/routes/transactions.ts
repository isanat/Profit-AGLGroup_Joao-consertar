import { Router } from "express";
import { db, transactionsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /transactions
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, startDate, endDate, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const all = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, req.userId!))
      .orderBy(desc(transactionsTable.createdAt));

    let filtered = all;
    if (type) filtered = filtered.filter(t => t.type === type);
    if (startDate) filtered = filtered.filter(t => t.createdAt >= new Date(startDate));
    if (endDate) filtered = filtered.filter(t => t.createdAt <= new Date(endDate));

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limitNum);

    res.json({
      data: data.map(t => ({
        id: t.id, userId: t.userId, type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        description: t.description,
        referenceId: t.referenceId,
        referenceType: t.referenceType,
        createdAt: t.createdAt,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "List transactions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
