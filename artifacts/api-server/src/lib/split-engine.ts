import { db, usersTable, transactionsTable, commissionsTable, notificationsTable,
  partnersTable, partnerSplitsTable, paymentInvoicesTable, depositsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSetting } from "./settings";
import { logger } from "./logger";

/**
 * Credit a confirmed payment to the user's balance + record transaction +
 * referral commission + partner split. Idempotent: if the invoice was already
 * processed, does nothing.
 *
 * This is the SINGLE source of truth for "dinheiro real entrou na plataforma".
 * Called from:
 *   - NowPayments webhook (invoice confirmed)
 *   - Mercado Pago webhook (PIX approved)
 *   - Manual admin confirm (legacy deposit flow) — via creditManualDeposit()
 */
export async function processConfirmedInvoice(invoiceId: number): Promise<{ processed: boolean; reason?: string }> {
  const [invoice] = await db.select().from(paymentInvoicesTable)
    .where(eq(paymentInvoicesTable.id, invoiceId));
  if (!invoice) return { processed: false, reason: "invoice not found" };
  if (invoice.status === "confirmed") return { processed: false, reason: "already confirmed" };

  const amount = Number(invoice.amountRequested);
  if (amount <= 0) return { processed: false, reason: "invalid amount" };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, invoice.userId));
  if (!user) return { processed: false, reason: "user not found" };

  // 1. Mark invoice confirmed
  await db.update(paymentInvoicesTable).set({
    status: "confirmed",
    providerStatus: invoice.providerStatus,
    confirmedAt: new Date(),
  }).where(eq(paymentInvoicesTable.id, invoiceId));

  // 2. Credit user balance
  const balanceBefore = Number(user.balance);
  const balanceAfter = balanceBefore + amount;
  await db.update(usersTable).set({ balance: String(balanceAfter) })
    .where(eq(usersTable.id, user.id));

  // 3. Record transaction
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    description: `Depósito confirmado via ${invoice.provider} (${invoice.payCurrency || "—"})`,
    referenceId: invoiceId,
    referenceType: "payment_invoice",
  });

  // 4. Create a matching legacy deposit row (so the admin deposits screen shows it)
  const [deposit] = await db.insert(depositsTable).values({
    userId: user.id,
    method: (invoice.payCurrency === "pix" ? "pix" : "usdt_bep20") as any,
    amount: String(amount),
    status: "confirmed",
    walletAddress: invoice.payAddress,
    transactionHash: invoice.providerInvoiceId,
    qrCodeUrl: invoice.qrCodeUrl,
    notes: `Auto-confirmado via ${invoice.provider}`,
    confirmedAt: new Date(),
    confirmedBy: null,
  }).returning();

  // Link invoice → deposit
  await db.update(paymentInvoicesTable).set({
    referenceType: "deposit",
    referenceId: deposit.id,
  }).where(eq(paymentInvoicesTable.id, invoiceId));

  // 5. Notify user
  await db.insert(notificationsTable).values({
    userId: user.id,
    title: "Depósito confirmado",
    message: `Seu depósito de R$ ${amount.toFixed(2)} foi confirmado automaticamente e creditado na sua conta.`,
    type: "success",
  });

  // 6. Referral commission (1 level)
  await applyReferralCommission(user.id, amount, deposit.id);

  // 7. Partner split
  await applyPartnerSplit(user.id, amount, invoiceId, deposit.id);

  logger.info({ invoiceId, userId: user.id, amount }, "Payment invoice confirmed & processed");
  return { processed: true };
}

/**
 * Apply referral commission to the user's referrer (level 1 only by default).
 * Idempotent: one commission per deposit.
 */
async function applyReferralCommission(userId: number, amount: number, depositId: number): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.referredBy) return;

  // Anti-duplicate
  const [existing] = await db.select({ id: commissionsTable.id })
    .from(commissionsTable)
    .where(and(eq(commissionsTable.fromUserId, userId), eq(commissionsTable.referenceId, depositId)))
    .limit(1);
  if (existing) return;

  const rate = Number(await getSetting("referralCommissionPercent")) || 0;
  if (rate <= 0) return;

  const commissionAmount = parseFloat((amount * rate / 100).toFixed(8));
  if (commissionAmount <= 0) return;

  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, user.referredBy));
  if (!referrer) return;

  const refBefore = Number(referrer.balance);
  const refAfter = refBefore + commissionAmount;
  await db.update(usersTable).set({ balance: String(refAfter) })
    .where(eq(usersTable.id, referrer.id));

  await db.insert(commissionsTable).values({
    userId: referrer.id,
    fromUserId: user.id,
    amount: String(commissionAmount),
    rate: String(rate),
    level: 1,
    status: "paid",
    referenceId: depositId,
    paidAt: new Date(),
  });

  await db.insert(transactionsTable).values({
    userId: referrer.id,
    type: "commission",
    amount: String(commissionAmount),
    balanceBefore: String(refBefore),
    balanceAfter: String(refAfter),
    description: `Bônus de indicação — depósito de ${user.name} (R$ ${amount.toFixed(2)})`,
    referenceId: depositId,
    referenceType: "deposit",
  });

  await db.insert(notificationsTable).values({
    userId: referrer.id,
    title: "Bônus de indicação creditado",
    message: `R$ ${commissionAmount.toFixed(2)} creditados pelo depósito de ${user.name}.`,
    type: "success",
  });
}

/**
 * Apply partner split: distributes `amount * splitPercent / 100` to each active
 * partner. If the sum of all partners' percentages exceeds 100%, they are
 * normalized proportionally. The remainder (if sum < 100%) stays with the
 * platform. Idempotent: one split per (invoice, partner).
 */
export async function applyPartnerSplit(
  userId: number,
  amount: number,
  invoiceId: number,
  depositId: number,
): Promise<void> {
  const splitEnabled = (await getSetting("partnerSplitEnabled")) !== "false";
  if (!splitEnabled) return;

  const partners = await db.select().from(partnersTable)
    .where(eq(partnersTable.status, "active"));
  if (partners.length === 0) return;

  // Sum all percentages
  const totalPct = partners.reduce((a, p) => a + Number(p.splitPercent), 0);
  if (totalPct <= 0) return;

  // Normalize if sum > 100 (otherwise use as-is; remainder stays with platform)
  const normalizationFactor = totalPct > 100 ? 100 / totalPct : 1;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const userName = user?.name || "Cliente";

  for (const partner of partners) {
    const rawPct = Number(partner.splitPercent);
    const effectivePct = rawPct * normalizationFactor;
    const splitAmount = parseFloat((amount * effectivePct / 100).toFixed(8));
    if (splitAmount <= 0) continue;

    // Idempotency: skip if already split for this invoice
    const [existing] = await db.select({ id: partnerSplitsTable.id })
      .from(partnerSplitsTable)
      .where(and(
        eq(partnerSplitsTable.partnerId, partner.id),
        eq(partnerSplitsTable.paymentInvoiceId, invoiceId),
      ))
      .limit(1);
    if (existing) continue;

    await db.insert(partnerSplitsTable).values({
      partnerId: partner.id,
      paymentInvoiceId: invoiceId,
      userId,
      baseAmount: String(amount),
      splitPercent: String(effectivePct),
      amount: String(splitAmount),
      status: "credited",
      description: `Split de pagamento — depósito R$ ${amount.toFixed(2)} de ${userName}`,
    });

    // Credit partner balance (withdrawable)
    const newBalanceDue = Number(partner.balanceDue) + splitAmount;
    const newTotalEarned = Number(partner.totalEarned) + splitAmount;
    await db.update(partnersTable).set({
      balanceDue: String(newBalanceDue),
      totalEarned: String(newTotalEarned),
    }).where(eq(partnersTable.id, partner.id));

    logger.info({ partnerId: partner.id, invoiceId, amount: splitAmount, pct: effectivePct }, "Partner split credited");
  }
}
