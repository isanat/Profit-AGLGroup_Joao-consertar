import cron from "node-cron";
import { db, withdrawalsTable, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "./logger";
import { getSetting } from "./settings";
import { approveWithdrawal } from "../routes/withdrawals";

let task: cron.ScheduledTask | null = null;

/**
 * Cron que roda a cada 10 minutos para auto-aprovar saques que atendem aos critérios:
 *  - withdrawalAutoApproveEnabled = true
 *  - valor <= withdrawalAutoApproveLimit
 *  - usuário cadastrado há >= withdrawalAutoApproveMinAccountAgeDays
 *  - usuário ativo (não suspended/pending)
 *
 * Saques acima do limite ou de usuários novos continuam exigindo aprovação manual.
 * Esta é uma conveniência para a maioria dos saques de baixo valor ( anti-fraude
 * ainda se aplica via limite e idade da conta ).
 */
export function startWithdrawalCron(): void {
  if (task) task.stop();
  task = cron.schedule("*/10 * * * *", async () => {
    try {
      await autoApproveWithdrawals();
    } catch (err) {
      logger.error({ err }, "Withdrawal auto-approve cron: unhandled error");
    }
  });
  logger.info("Withdrawal auto-approve cron started (every 10 min)");
}

export function stopWithdrawalCron(): void {
  if (task) { task.stop(); task = null; }
}

async function autoApproveWithdrawals(): Promise<void> {
  const enabled = (await getSetting("withdrawalAutoApproveEnabled")) === "true";
  if (!enabled) return;

  const limit = Number(await getSetting("withdrawalAutoApproveLimit")) || 0;
  const minAgeDays = Number(await getSetting("withdrawalAutoApproveMinAccountAgeDays")) || 0;
  if (limit <= 0) return;

  const pending = await db.select().from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));

  if (pending.length === 0) return;

  const now = new Date();
  const minAgeMs = minAgeDays * 24 * 60 * 60 * 1000;
  const users = await db.select().from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  let approved = 0;
  for (const w of pending) {
    const amount = Number(w.amount);
    if (amount > limit) continue;

    const user = userMap[w.userId];
    if (!user) continue;
    if (user.status !== "active") continue;

    const accountAge = now.getTime() - new Date(user.createdAt).getTime();
    if (accountAge < minAgeMs) continue;

    try {
      await approveWithdrawal(w.id, "approve", undefined, "Auto-aprovado pelo sistema (abaixo do limite)");
      // Notify user
      await db.insert(notificationsTable).values({
        userId: w.userId,
        title: "Saque aprovado",
        message: `Seu saque de R$ ${amount.toFixed(2)} foi aprovado automaticamente e está sendo processado.`,
        type: "success",
      });
      approved++;
      logger.info({ withdrawalId: w.id, userId: w.userId, amount }, "Withdrawal auto-approved");
    } catch (err) {
      logger.error({ err, withdrawalId: w.id }, "Failed to auto-approve withdrawal");
    }
  }
  if (approved > 0) {
    logger.info({ approved, total: pending.length }, "Withdrawal auto-approve cron: batch complete");
  }
}
