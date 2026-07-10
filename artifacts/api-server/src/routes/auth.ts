import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, sessionsTable, referralsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { generateTokens, verifyRefreshToken, requireAuth, type AuthRequest } from "../middlewares/auth";
import { generateReferralCode } from "../lib/referral";
import { auditLog } from "../lib/audit";

const router = Router();

// GET /auth/validate-referral?code=CODE  (public — no auth required)
router.get("/validate-referral", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ valid: false, error: "Código é obrigatório." });
      return;
    }
    const [referrer] = await db
      .select({ id: usersTable.id, name: usersTable.name, referralCode: usersTable.referralCode, status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code));

    if (!referrer) {
      res.json({ valid: false, error: "Código de indicação inválido." });
      return;
    }
    if (referrer.status !== "active") {
      res.json({ valid: false, error: "Este indicador está inativo." });
      return;
    }
    res.json({ valid: true, referrerName: referrer.name, referralCode: referrer.referralCode });
  } catch (err) {
    req.log.error({ err }, "Validate referral error");
    res.status(500).json({ valid: false, error: "Erro interno." });
  }
});

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, country, referralCode } = req.body;
    if (!name || !email || !password || !confirmPassword) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "As senhas não conferem." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres." });
      return;
    }
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (existing) {
      res.status(400).json({ error: "E-mail já cadastrado." });
      return;
    }
    let referrerId: number | undefined;
    if (referralCode) {
      const [referrer] = await db
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.referralCode, referralCode.toUpperCase()));
      if (!referrer) {
        res.status(400).json({ error: "Código de indicação inválido." });
        return;
      }
      if (referrer.status !== "active") {
        res.status(400).json({ error: "Este indicador está inativo." });
        return;
      }
      referrerId = referrer.id;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const myReferralCode = generateReferralCode();
    const emailVerifyToken = randomBytes(32).toString("hex");
    const [user] = await db.insert(usersTable).values({
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      country: country || null,
      passwordHash,
      referralCode: myReferralCode,
      referredBy: referrerId ?? null,
      emailVerifyToken,
      status: "active",
      emailVerified: true,
    }).returning();
    if (referrerId) {
      await db.insert(referralsTable).values({ referrerId, referredId: user.id, level: 1 });
    }
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({
      userId: user.id,
      refreshToken,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      expiresAt,
    });
    await auditLog({ userId: user.id, userEmail: user.email, action: "register", entityType: "user", entityId: user.id, metadata: { referralCode: referralCode || null, referrerId: referrerId || null }, req });
    res.status(201).json({ accessToken, refreshToken, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }
    if (user.status === "suspended") {
      res.status(403).json({ error: "Conta suspensa." });
      return;
    }
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({
      userId: user.id, refreshToken,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      expiresAt,
    });
    await auditLog({ userId: user.id, userEmail: user.email, action: "login", entityType: "user", entityId: user.id, req });
    res.json({ accessToken, refreshToken, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, req.userId));
    }
    res.json({ message: "Deslogado com sucesso." });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: "Refresh token obrigatório." }); return; }
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) { res.status(401).json({ error: "Token inválido." }); return; }
    const [session] = await db.select().from(sessionsTable)
      .where(and(eq(sessionsTable.refreshToken, refreshToken), gt(sessionsTable.expiresAt, new Date())));
    if (!session) { res.status(401).json({ error: "Sessão expirada." }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) { res.status(401).json({ error: "Usuário não encontrado." }); return; }
    const tokens = generateTokens(user.id, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.update(sessionsTable).set({ refreshToken: tokens.refreshToken, lastUsedAt: new Date(), expiresAt }).where(eq(sessionsTable.id, session.id));
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Refresh error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "E-mail obrigatório." }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, (email || "").toLowerCase()));
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(usersTable)
        .set({ passwordResetToken: token, passwordResetExpiry: expiry })
        .where(eq(usersTable.id, user.id));

      const domain = process.env.SITE_URL
        || `https://${req.headers.host || "flashymining.com"}`;
      const resetLink = `${domain.replace(/\/+$/, "")}/reset-password?token=${token}`;

      req.log.info({ userId: user.id, email: user.email, resetLink }, "Password reset token generated");
      await auditLog({ userId: user.id, userEmail: user.email, action: "forgot_password", entityType: "user", entityId: user.id, metadata: { resetLink, expiresAt: expiry.toISOString() }, req });
    }
    res.json({ message: "Se o e-mail estiver cadastrado, o link de redefinição foi gerado." });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: "Token e nova senha são obrigatórios." });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "As senhas não conferem." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(
      and(eq(usersTable.passwordResetToken, token), gt(usersTable.passwordResetExpiry!, new Date()))
    );
    if (!user) {
      res.status(400).json({ error: "Link de redefinição inválido ou expirado." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(usersTable)
      .set({ passwordHash, passwordResetToken: null, passwordResetExpiry: null })
      .where(eq(usersTable.id, user.id));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
    await auditLog({ userId: user.id, userEmail: user.email, action: "reset_password", entityType: "user", entityId: user.id, req });
    res.json({ message: "Senha redefinida com sucesso." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.emailVerifyToken, token));
    if (!user) { res.status(400).json({ error: "Token inválido." }); return; }
    await db.update(usersTable).set({ emailVerified: true, emailVerifyToken: null, status: "active" }).where(eq(usersTable.id, user.id));
    res.json({ message: "E-mail verificado com sucesso." });
  } catch (err) {
    req.log.error({ err }, "Verify email error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/enable-2fa
router.post("/enable-2fa", requireAuth, async (req: AuthRequest, res) => {
  const secret = randomBytes(20).toString("base64");
  const qrCodeUrl = `otpauth://totp/InvestFlow:user?secret=${secret}&issuer=InvestFlow`;
  const backupCodes = Array.from({ length: 8 }, () => randomBytes(4).toString("hex"));
  if (req.userId) {
    await db.update(usersTable).set({ twoFactorSecret: secret }).where(eq(usersTable.id, req.userId));
  }
  res.json({ secret, qrCodeUrl, backupCodes });
});

// POST /auth/verify-2fa
router.post("/verify-2fa", requireAuth, async (req: AuthRequest, res) => {
  if (req.userId) {
    await db.update(usersTable).set({ twoFactorEnabled: true }).where(eq(usersTable.id, req.userId));
  }
  res.json({ message: "2FA habilitado com sucesso." });
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    country: user.country, avatarUrl: user.avatarUrl, role: user.role,
    status: user.status, emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled, referralCode: user.referralCode,
    balance: Number(user.balance), totalInvested: Number(user.totalInvested),
    totalYield: Number(user.totalYield), createdAt: user.createdAt,
  };
}

export default router;
