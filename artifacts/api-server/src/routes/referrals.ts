import { Router } from "express";
import { db, usersTable, referralsTable, commissionsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getSetting } from "../lib/settings";

const router = Router();

// GET /referrals
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "Not found" }); return; }

    const refs = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.userId!));
    const refUserIds = refs.map(r => r.referredId);

    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    // Paid commissions earned by this user
    const paidCommissions = await db.select().from(commissionsTable)
      .where(and(eq(commissionsTable.userId, req.userId!), eq(commissionsTable.status, "paid")));

    // Group commissions by fromUserId for per-referral totals
    const commissionByFromUser: Record<number, number> = {};
    for (const c of paidCommissions) {
      const prev = commissionByFromUser[c.fromUserId] ?? 0;
      commissionByFromUser[c.fromUserId] = prev + Number(c.amount);
    }

    const commissionRate = Number(await getSetting("referralCommissionPercent")) || 5;
    // Build the referral link using the actual domain the user is accessing from.
    // Priority: SITE_URL env > request host header (always correct in production).
    const siteUrl = process.env.SITE_URL
      || `https://${req.headers.host || "flashymining.com"}`;
    const baseUrl = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;

    const refMembers = refs.map(r => {
      const u = userMap[r.referredId];
      return u ? {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        totalInvested: Number(u.totalInvested),
        commissionGenerated: commissionByFromUser[u.id] ?? 0,
        joinedAt: u.createdAt,
      } : null;
    }).filter(Boolean);

    res.json({
      referralCode: user.referralCode,
      referralLink: `${baseUrl}/register?ref=${user.referralCode}`,
      totalReferrals: refs.length,
      activeReferrals: refMembers.filter(r => r?.status === "active").length,
      totalCommissionEarned: paidCommissions.reduce((a, c) => a + Number(c.amount), 0),
      pendingCommission: 0,
      commissionRate,
      referrals: refMembers,
    });
  } catch (err) {
    req.log.error({ err }, "Referral info error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /referrals/tree
router.get("/tree", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "Not found" }); return; }

    const allRefs = await db.select().from(referralsTable);
    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    function buildTree(userId: number, level: number): any {
      if (level > 3) return null;
      const directRefs = allRefs.filter(r => r.referrerId === userId);
      return {
        id: userId,
        name: userMap[userId]?.name ?? "Unknown",
        email: userMap[userId]?.email ?? "",
        level,
        children: directRefs.map(r => buildTree(r.referredId, level + 1)).filter(Boolean),
      };
    }

    res.json(buildTree(req.userId!, 0));
  } catch (err) {
    req.log.error({ err }, "Referral tree error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /referrals/commissions
router.get("/commissions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const commissions = await db.select().from(commissionsTable)
      .where(eq(commissionsTable.userId, req.userId!))
      .orderBy(desc(commissionsTable.createdAt));

    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    res.json(commissions.map(c => ({
      id: c.id,
      fromUserId: c.fromUserId,
      fromUserName: userMap[c.fromUserId]?.name ?? "Usuário",
      amount: Number(c.amount),
      rate: Number(c.rate),
      level: c.level,
      status: c.status,
      depositId: c.referenceId,
      paidAt: c.paidAt,
      createdAt: c.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Commissions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
