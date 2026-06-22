import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /users/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /users/me
router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name, phone, country, avatarUrl,
      btcWallet, usdtWallet, usdcWallet,
      pixKeyType, pixKey, pixBankName,
    } = req.body;

    const [user] = await db.update(usersTable)
      .set({
        ...(name !== undefined && { name }),
        phone: phone ?? null,
        country: country ?? null,
        avatarUrl: avatarUrl ?? null,
        btcWallet: btcWallet ?? null,
        usdtWallet: usdtWallet ?? null,
        usdcWallet: usdcWallet ?? null,
        pixKeyType: pixKeyType ?? null,
        pixKey: pixKey ?? null,
        pixBankName: pixBankName ?? null,
      })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Update me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /users/me/change-password
router.post("/me/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.userId!));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/me/sessions
router.get("/me/sessions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessions = await db.select().from(sessionsTable)
      .where(and(eq(sessionsTable.userId, req.userId!), gt(sessionsTable.expiresAt, new Date())));
    res.json(sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: false,
    })));
  } catch (err) {
    req.log.error({ err }, "Get sessions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    referralCode: user.referralCode,
    balance: Number(user.balance),
    totalInvested: Number(user.totalInvested),
    totalYield: Number(user.totalYield),
    createdAt: user.createdAt,
    btcWallet: user.btcWallet,
    usdtWallet: user.usdtWallet,
    usdcWallet: user.usdcWallet,
    pixKeyType: user.pixKeyType,
    pixKey: user.pixKey,
    pixBankName: user.pixBankName,
  };
}

export default router;
