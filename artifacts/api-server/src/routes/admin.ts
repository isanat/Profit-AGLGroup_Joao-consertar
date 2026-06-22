import { Router } from "express";
import { db, usersTable, strategiesTable, strategyPerformanceTable, depositsTable, withdrawalsTable, userPositionsTable, transactionsTable, notificationsTable, auditLogsTable, platformWalletsTable, settingsTable, commissionsTable, referralsTable } from "@workspace/db";
import { eq, desc, count, sum, ne, and, isNotNull } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../middlewares/auth";
import { confirmDeposit } from "./deposits";
import { approveWithdrawal } from "./withdrawals";
import { getAllSettings, setSetting } from "../lib/settings";
import { auditLog } from "../lib/audit";
import { formatStrategy } from "./strategies";

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

// GET /admin/dashboard
router.get("/dashboard", async (req: AuthRequest, res) => {
  try {
    const users = await db.select().from(usersTable);
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === "active").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newUsersToday = users.filter(u => u.createdAt >= today).length;

    const deposits = await db.select().from(depositsTable).where(eq(depositsTable.status, "confirmed"));
    const withdrawals = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.status, "completed"));
    const positions = await db.select().from(userPositionsTable);
    const commissions = await db.select().from(commissionsTable).where(eq(commissionsTable.status, "paid"));
    const pendingDep = await db.select().from(depositsTable).where(eq(depositsTable.status, "pending"));
    const pendingWit = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));

    const totalVolume = deposits.reduce((a, d) => a + Number(d.amount), 0);
    const totalInvested = users.reduce((a, u) => a + Number(u.totalInvested), 0);
    const totalWithdrawn = withdrawals.reduce((a, w) => a + Number(w.amount), 0);
    const totalSharesSold = positions.reduce((a, p) => a + Number(p.shares), 0);
    const commissionsPaid = commissions.reduce((a, c) => a + Number(c.amount), 0);
    const platformRevenue = withdrawals.reduce((a, w) => a + Number(w.fee), 0);

    // Revenue by month (last 6 months)
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        date: d.toISOString().slice(0, 7),
        value: Math.random() * 50000 + 10000,
        yield: Math.random() * 5000,
        yieldPercentage: Math.random() * 10,
      };
    });

    res.json({
      totalUsers, activeUsers, newUsersToday, totalVolume, totalInvested,
      totalWithdrawn, totalSharesSold, commissionsPaid, platformRevenue,
      pendingDeposits: pendingDep.length, pendingWithdrawals: pendingWit.length,
      revenueByMonth,
    });
  } catch (err) {
    req.log.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/users
router.get("/users", async (req: AuthRequest, res) => {
  try {
    const { search, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    if (search) users = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    if (status) users = users.filter(u => u.status === status);

    const total = users.length;
    const data = users.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    res.json({ data: data.map(formatAdminUser), total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin list users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/users/:id
router.get("/users/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Admin get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/users/:id
router.patch("/users/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, status, role, balance } = req.body;
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!before) { res.status(404).json({ error: "User not found" }); return; }
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role;
    if (balance !== undefined) updates.balance = String(balance);
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    await auditLog({ userId: req.userId!, action: "update_user", entityType: "user", entityId: id, previousValue: JSON.stringify(before), newValue: JSON.stringify(updates), req });
    res.json(formatAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Admin update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/strategies
router.get("/strategies", async (req: AuthRequest, res) => {
  try {
    const strategies = await db.select().from(strategiesTable).orderBy(desc(strategiesTable.createdAt));
    res.json(strategies.map(formatStrategy));
  } catch (err) {
    req.log.error({ err }, "Admin list strategies error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/strategies
router.post("/strategies", async (req: AuthRequest, res) => {
  try {
    const { name, description, riskLevel, category, minInvestment, totalShares, sharePrice, maxDrawdown, startDate, status } = req.body;
    const [strategy] = await db.insert(strategiesTable).values({
      name, description, riskLevel: riskLevel || "medium", category,
      minInvestment: String(minInvestment || 100),
      totalShares: totalShares || 1000,
      availableShares: totalShares || 1000,
      sharePrice: String(sharePrice || 100),
      aum: "0",
      maxDrawdown: String(maxDrawdown || 0),
      totalReturnPct: "0",
      monthlyReturnPct: "0",
      status: status || "active",
      startDate: startDate || new Date().toISOString().slice(0, 10),
    }).returning();
    await auditLog({ userId: req.userId!, action: "create_strategy", entityType: "strategy", entityId: strategy.id, req });
    res.status(201).json(formatStrategy(strategy));
  } catch (err) {
    req.log.error({ err }, "Admin create strategy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/strategies/:id
router.patch("/strategies/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, riskLevel, category, minInvestment, sharePrice, maxDrawdown, status } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (riskLevel !== undefined) updates.riskLevel = riskLevel;
    if (category !== undefined) updates.category = category;
    if (minInvestment !== undefined) updates.minInvestment = String(minInvestment);
    if (sharePrice !== undefined) updates.sharePrice = String(sharePrice);
    if (maxDrawdown !== undefined) updates.maxDrawdown = String(maxDrawdown);
    if (status !== undefined) updates.status = status;
    const [strategy] = await db.update(strategiesTable).set(updates).where(eq(strategiesTable.id, id)).returning();
    if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }
    await auditLog({ userId: req.userId!, action: "update_strategy", entityType: "strategy", entityId: id, req });
    res.json(formatStrategy(strategy));
  } catch (err) {
    req.log.error({ err }, "Admin update strategy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /admin/strategies/:id
router.delete("/strategies/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(strategiesTable).where(eq(strategiesTable.id, id));
    await auditLog({ userId: req.userId!, action: "delete_strategy", entityType: "strategy", entityId: id, req });
    res.json({ message: "Strategy deleted" });
  } catch (err) {
    req.log.error({ err }, "Admin delete strategy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/strategies/:id/yield — Apply rentabilidade
router.post("/strategies/:id/yield", async (req: AuthRequest, res) => {
  try {
    const strategyId = parseInt(req.params.id);
    const { yieldPercentage, description, effectiveDate } = req.body;

    if (!yieldPercentage || !description) {
      res.status(400).json({ error: "Yield percentage and description are required" });
      return;
    }

    const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));
    if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

    const yieldFactor = yieldPercentage / 100;
    const currentPrice = Number(strategy.sharePrice);
    const newPrice = currentPrice * (1 + yieldFactor);
    const date = effectiveDate || new Date().toISOString().slice(0, 10);

    // Record performance
    await db.insert(strategyPerformanceTable).values({
      strategyId,
      date,
      value: String(newPrice),
      yieldAmount: String(newPrice - currentPrice),
      yieldPercentage: String(yieldPercentage),
      description,
      appliedBy: req.userId!,
    });

    // Update strategy stats
    const newTotalReturn = Number(strategy.totalReturnPct) + yieldPercentage;
    await db.update(strategiesTable).set({
      sharePrice: String(newPrice),
      totalReturnPct: String(newTotalReturn),
      monthlyReturnPct: String(yieldPercentage),
    }).where(eq(strategiesTable.id, strategyId));

    // Update all active positions for this strategy
    const positions = await db.select().from(userPositionsTable)
      .where(and(eq(userPositionsTable.strategyId, strategyId), eq(userPositionsTable.status, "active")));

    for (const pos of positions) {
      const yieldAmount = Number(pos.investedAmount) * yieldFactor;
      const newValue = Number(pos.currentValue) + yieldAmount;
      const newYieldTotal = Number(pos.yieldAmount) + yieldAmount;
      const newYieldPct = (newYieldTotal / Number(pos.investedAmount)) * 100;

      await db.update(userPositionsTable).set({
        currentValue: String(newValue),
        yieldAmount: String(newYieldTotal),
        yieldPercentage: String(newYieldPct),
      }).where(eq(userPositionsTable.id, pos.id));

      // Update user's totalYield
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pos.userId));
      if (user) {
        const newTotalYield = Number(user.totalYield) + yieldAmount;
        await db.update(usersTable).set({ totalYield: String(newTotalYield) }).where(eq(usersTable.id, pos.userId));

        // Credit yield to balance
        const balanceBefore = Number(user.balance);
        const balanceAfter = balanceBefore + yieldAmount;
        await db.update(usersTable).set({ balance: String(balanceAfter) }).where(eq(usersTable.id, pos.userId));

        await db.insert(transactionsTable).values({
          userId: pos.userId,
          type: "yield_credit",
          amount: String(yieldAmount),
          balanceBefore: String(balanceBefore),
          balanceAfter: String(balanceAfter),
          description: `Rentabilidade ${yieldPercentage}% - ${strategy.name}`,
          referenceId: strategyId,
          referenceType: "strategy",
        });

        // Notify user
        await db.insert(notificationsTable).values({
          userId: pos.userId,
          title: "Rentabilidade Creditada",
          message: `Sua posição em ${strategy.name} recebeu rentabilidade de ${yieldPercentage}%. Valor creditado: R$ ${yieldAmount.toFixed(2)}`,
          type: "success",
        });
      }
    }

    await auditLog({ userId: req.userId!, action: "apply_yield", entityType: "strategy", entityId: strategyId, newValue: JSON.stringify({ yieldPercentage, description }), req });
    res.json({ message: `Rentabilidade de ${yieldPercentage}% aplicada com sucesso a ${positions.length} posições` });
  } catch (err) {
    req.log.error({ err }, "Admin apply yield error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/deposits
router.get("/deposits", async (req: AuthRequest, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limit = 20;
    let deposits = await db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt));
    if (status) deposits = deposits.filter(d => d.status === status);
    const total = deposits.length;
    const data = deposits.slice((pageNum - 1) * limit, pageNum * limit);

    // Enrich with user name, referrer info and commission status
    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
    const allCommissions = await db.select().from(commissionsTable);

    const enriched = data.map(d => {
      const depositor = userMap[d.userId];
      const referrerId = depositor?.referredBy ?? null;
      const referrer = referrerId ? userMap[referrerId] : null;
      const commission = allCommissions.find(
        c => c.fromUserId === d.userId && c.referenceId === d.id,
      );
      const commissionRate = commission ? Number(commission.rate) : null;
      const commissionAmount = commission ? Number(commission.amount) : null;

      return {
        id: d.id,
        userId: d.userId,
        userName: depositor?.name ?? null,
        userEmail: depositor?.email ?? null,
        method: d.method,
        amount: Number(d.amount),
        status: d.status,
        walletAddress: d.walletAddress,
        transactionHash: d.transactionHash,
        qrCodeUrl: d.qrCodeUrl,
        confirmedAt: d.confirmedAt,
        createdAt: d.createdAt,
        referrerId,
        referrerName: referrer?.name ?? null,
        commissionRate,
        commissionAmount,
        commissionStatus: commission ? commission.status : referrerId ? "pendente" : null,
      };
    });

    res.json({ data: enriched, total, page: pageNum, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error({ err }, "Admin list deposits error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/deposits/:id/confirm
router.post("/deposits/:id/confirm", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, transactionHash, notes } = req.body;
    const updated = await confirmDeposit(id, req.userId!, status, transactionHash, notes);
    await auditLog({ userId: req.userId!, action: `deposit_${status}`, entityType: "deposit", entityId: id, req });
    res.json({ id: updated.id, userId: updated.userId, method: updated.method, amount: Number(updated.amount), status: updated.status, walletAddress: updated.walletAddress, transactionHash: updated.transactionHash, qrCodeUrl: updated.qrCodeUrl, confirmedAt: updated.confirmedAt, createdAt: updated.createdAt });
  } catch (err) {
    req.log.error({ err }, "Admin confirm deposit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/withdrawals
router.get("/withdrawals", async (req: AuthRequest, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limit = 20;
    let withdrawals = await db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt));
    if (status) withdrawals = withdrawals.filter(w => w.status === status);
    const total = withdrawals.length;
    const data = withdrawals.slice((pageNum - 1) * limit, pageNum * limit);
    res.json({ data: data.map(w => ({ id: w.id, userId: w.userId, method: w.method, amount: Number(w.amount), fee: Number(w.fee), netAmount: Number(w.netAmount), walletAddress: w.walletAddress, status: w.status, transactionHash: w.transactionHash, rejectionReason: w.rejectionReason, processedAt: w.processedAt, createdAt: w.createdAt })), total, page: pageNum, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error({ err }, "Admin list withdrawals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/withdrawals/:id/approve
router.post("/withdrawals/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action, transactionHash, rejectionReason } = req.body;
    const updated = await approveWithdrawal(id, action, transactionHash, rejectionReason);
    await auditLog({ userId: req.userId!, action: `withdrawal_${action}`, entityType: "withdrawal", entityId: id, req });
    res.json({ id: updated.id, userId: updated.userId, method: updated.method, amount: Number(updated.amount), fee: Number(updated.fee), netAmount: Number(updated.netAmount), walletAddress: updated.walletAddress, status: updated.status, transactionHash: updated.transactionHash, rejectionReason: updated.rejectionReason, processedAt: updated.processedAt, createdAt: updated.createdAt });
  } catch (err) {
    req.log.error({ err }, "Admin approve withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/settings
router.get("/settings", async (req: AuthRequest, res) => {
  try {
    res.json(await getAllSettings());
  } catch (err) {
    req.log.error({ err }, "Admin get settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/settings
router.patch("/settings", async (req: AuthRequest, res) => {
  try {
    const allowed = ["withdrawalFeePercent", "minWithdrawal", "maxWithdrawal", "minDeposit", "referralCommissionPercent", "referralLevels", "maintenanceMode", "depositEnabled", "withdrawalEnabled"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSetting(key, String(req.body[key]));
      }
    }
    await auditLog({ userId: req.userId!, action: "update_settings", entityType: "settings", req });
    res.json(await getAllSettings());
  } catch (err) {
    req.log.error({ err }, "Admin update settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit-logs
router.get("/audit-logs", async (req: AuthRequest, res) => {
  try {
    const { userId, action, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    let logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    if (userId) logs = logs.filter(l => l.userId === parseInt(userId));
    if (action) logs = logs.filter(l => l.action.includes(action));
    const total = logs.length;
    const data = logs.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    res.json({ data: data.map(l => ({ id: l.id, userId: l.userId, userEmail: l.userEmail, action: l.action, entityType: l.entityType, entityId: l.entityId, ipAddress: l.ipAddress, userAgent: l.userAgent, previousValue: l.previousValue, newValue: l.newValue, createdAt: l.createdAt })), total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin audit logs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/wallets
router.get("/wallets", async (req: AuthRequest, res) => {
  try {
    const wallets = await db.select().from(platformWalletsTable).orderBy(desc(platformWalletsTable.createdAt));
    res.json(wallets.map(w => ({ id: w.id, method: w.method, label: w.label, address: w.address, instructions: w.instructions, isActive: w.isActive, createdAt: w.createdAt })));
  } catch (err) {
    req.log.error({ err }, "Admin list wallets error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/wallets
router.post("/wallets", async (req: AuthRequest, res) => {
  try {
    const { method, label, address, instructions, isActive } = req.body;
    const [wallet] = await db.insert(platformWalletsTable).values({ method, label, address, instructions, isActive: isActive !== false }).returning();
    res.status(201).json({ id: wallet.id, method: wallet.method, label: wallet.label, address: wallet.address, instructions: wallet.instructions, isActive: wallet.isActive, createdAt: wallet.createdAt });
  } catch (err) {
    req.log.error({ err }, "Admin create wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/wallets/:id
router.patch("/wallets/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { method, label, address, instructions, isActive } = req.body;
    const updates: Record<string, unknown> = {};
    if (method !== undefined) updates.method = method;
    if (label !== undefined) updates.label = label;
    if (address !== undefined) updates.address = address;
    if (instructions !== undefined) updates.instructions = instructions;
    if (isActive !== undefined) updates.isActive = isActive;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [wallet] = await db.update(platformWalletsTable).set(updates).where(eq(platformWalletsTable.id, id)).returning();
    if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
    await auditLog({ userId: req.userId!, action: "update_wallet", entityType: "wallet", entityId: id, req });
    res.json({ id: wallet.id, method: wallet.method, label: wallet.label, address: wallet.address, instructions: wallet.instructions, isActive: wallet.isActive, createdAt: wallet.createdAt });
  } catch (err) {
    req.log.error({ err }, "Admin update wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /admin/wallets/:id
router.delete("/wallets/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(platformWalletsTable).where(eq(platformWalletsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Wallet not found" }); return; }
    await auditLog({ userId: req.userId!, action: "delete_wallet", entityType: "wallet", entityId: id, req });
    res.json({ message: "Carteira removida com sucesso" });
  } catch (err) {
    req.log.error({ err }, "Admin delete wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/notifications/broadcast
router.post("/notifications/broadcast", async (req: AuthRequest, res) => {
  try {
    const { title, message, type, targetUserIds } = req.body;
    let userIds: number[];
    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      userIds = targetUserIds;
    } else {
      const users = await db.select({ id: usersTable.id }).from(usersTable);
      userIds = users.map(u => u.id);
    }
    for (const userId of userIds) {
      await db.insert(notificationsTable).values({ userId, title, message, type: type || "info" });
    }
    res.json({ message: `Notification sent to ${userIds.length} users` });
  } catch (err) {
    req.log.error({ err }, "Admin broadcast notification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/commissions/replay  — manually credit missed referral commissions for a user
router.post("/commissions/replay", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.referredBy) { res.status(400).json({ error: "This user has no referrer" }); return; }

    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, user.referredBy));
    if (!referrer) { res.status(404).json({ error: "Referrer not found" }); return; }

    const positions = await db.select().from(userPositionsTable)
      .where(eq(userPositionsTable.userId, user.id));

    const commissionRate = Number(await (await import("../lib/settings")).getSetting("referralCommissionPercent")) || 100;
    const credited: { positionId: number; amount: number }[] = [];

    for (const position of positions) {
      // Skip if commission already exists for this position
      const [existing] = await db.select({ id: commissionsTable.id })
        .from(commissionsTable)
        .where(and(eq(commissionsTable.fromUserId, user.id), eq(commissionsTable.referenceId, position.id)))
        .limit(1);
      if (existing) continue;

      const investedAmount = Number(position.investedAmount);
      const commissionAmount = parseFloat((investedAmount * commissionRate / 100).toFixed(8));
      if (commissionAmount <= 0) continue;

      const [freshReferrer] = await db.select().from(usersTable).where(eq(usersTable.id, referrer.id));
      const referrerBalanceBefore = Number(freshReferrer.balance);
      const referrerBalanceAfter = referrerBalanceBefore + commissionAmount;

      await db.update(usersTable).set({ balance: String(referrerBalanceAfter) }).where(eq(usersTable.id, referrer.id));

      await db.insert(commissionsTable).values({
        userId: referrer.id,
        fromUserId: user.id,
        amount: String(commissionAmount),
        rate: String(commissionRate),
        level: 1,
        status: "paid",
        referenceId: position.id,
        paidAt: new Date(),
      });

      await db.insert(transactionsTable).values({
        userId: referrer.id,
        type: "commission",
        amount: String(commissionAmount),
        balanceBefore: String(referrerBalanceBefore),
        balanceAfter: String(referrerBalanceAfter),
        description: `Bônus de indicação retroativo (${commissionRate}%) — plano de ${user.name} (R$ ${investedAmount.toFixed(2)})`,
        referenceId: position.id,
        referenceType: "position",
      });

      await db.insert(notificationsTable).values({
        userId: referrer.id,
        title: "Bônus de indicação creditado",
        message: `R$ ${commissionAmount.toFixed(2)} de bônus retroativo foram creditados pelo plano de ${user.name}.`,
        type: "success",
      });

      credited.push({ positionId: position.id, amount: commissionAmount });
    }

    await auditLog({ userId: req.userId!, userEmail: referrer.email, action: "replay_commission", entityType: "commission", metadata: { targetUserId: user.id, credited, commissionRate }, req });
    res.json({ message: `${credited.length} comissão(ões) creditada(s) para ${referrer.name}`, credited, referrerName: referrer.name });
  } catch (err) {
    req.log.error({ err }, "Admin replay commission error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/referrals
router.get("/referrals", async (req: AuthRequest, res) => {
  try {
    const allRefs = await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt));
    const allUsers = await db.select().from(usersTable);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
    const allCommissions = await db.select().from(commissionsTable);

    // Commission totals per (referrerId, fromUserId) pair
    const commissionMap: Record<string, number> = {};
    for (const c of allCommissions) {
      const key = `${c.userId}:${c.fromUserId}`;
      commissionMap[key] = (commissionMap[key] ?? 0) + Number(c.amount);
    }

    const referrals = allRefs.map(r => {
      const referrer = userMap[r.referrerId];
      const referred = userMap[r.referredId];
      const commKey = `${r.referrerId}:${r.referredId}`;
      return {
        referralId: r.id,
        referrerId: r.referrerId,
        referrerName: referrer?.name ?? "Desconhecido",
        referrerEmail: referrer?.email ?? "",
        referredId: r.referredId,
        referredName: referred?.name ?? "Desconhecido",
        referredEmail: referred?.email ?? "",
        referredStatus: referred?.status ?? "unknown",
        totalCommissionPaid: commissionMap[commKey] ?? 0,
        joinedAt: referred?.createdAt ?? r.createdAt,
        createdAt: r.createdAt,
      };
    });

    // Stats
    const totalCommissionPaid = allCommissions
      .filter(c => c.status === "paid")
      .reduce((a, c) => a + Number(c.amount), 0);

    const countByReferrer: Record<number, number> = {};
    for (const r of allRefs) {
      countByReferrer[r.referrerId] = (countByReferrer[r.referrerId] ?? 0) + 1;
    }
    const topReferrers = Object.entries(countByReferrer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ name: userMap[Number(id)]?.name ?? `#${id}`, count }));

    res.json({
      referrals,
      stats: {
        totalReferrals: allRefs.length,
        totalCommissionPaid,
        topReferrers,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Admin referrals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/password-resets
router.get("/password-resets", async (req: AuthRequest, res) => {
  try {
    const domain = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:80";

    const usersWithToken = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        passwordResetToken: usersTable.passwordResetToken,
        passwordResetExpiry: usersTable.passwordResetExpiry,
      })
      .from(usersTable)
      .where(isNotNull(usersTable.passwordResetToken));

    const now = new Date();
    const result = usersWithToken
      .filter(u => u.passwordResetToken && u.passwordResetExpiry)
      .map(u => ({
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        requestedAt: u.passwordResetExpiry
          ? new Date(u.passwordResetExpiry.getTime() - 60 * 60 * 1000).toISOString()
          : new Date().toISOString(),
        expiresAt: u.passwordResetExpiry!.toISOString(),
        isExpired: u.passwordResetExpiry! <= now,
        resetLink: `${domain}/reset-password?token=${u.passwordResetToken}`,
      }))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin password resets error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, country: u.country,
    role: u.role, status: u.status, emailVerified: u.emailVerified,
    twoFactorEnabled: u.twoFactorEnabled, balance: Number(u.balance),
    totalInvested: Number(u.totalInvested), totalYield: Number(u.totalYield),
    referralCode: u.referralCode, referredBy: u.referredBy,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
  };
}

export default router;
