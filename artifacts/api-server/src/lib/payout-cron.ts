import cron from "node-cron";
import { db, partnerPayoutsTable, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getPayout, mapPayoutStatus } from "./nowpayments";
import { processPayoutWebhook, triggerAutoPayout } from "./split-engine";
import { refreshBrlUsdRate } from "./exchange-rate";

let task: cron.ScheduledTask | null = null;
let rateTask: cron.ScheduledTask | null = null;

/**
 * Cron que roda a cada 5 minutos para:
 * 1. Sincronizar payouts travados em "processing"/"awaiting_confirmation" com o NowPayments
 * 2. Retentar auto-payouts para sócios com balanceDue >= minPayout (caso um payout anterior falhou)
 */
export function startPayoutCron(): void {
  if (task) task.stop();
  task = cron.schedule("*/5 * * * *", async () => {
    try {
      await syncStuckPayouts();
      await retryPendingAutoPayouts();
    } catch (err) {
      logger.error({ err }, "Payout cron: unhandled error");
    }
  });
  logger.info("Payout cron started (every 5 min)");

  // Refresh BRL→USD rate daily at 02:00
  if (rateTask) rateTask.stop();
  rateTask = cron.schedule("0 2 * * *", async () => {
    try {
      await refreshBrlUsdRate();
    } catch (err) {
      logger.error({ err }, "Exchange rate refresh cron error");
    }
  });
  logger.info("Exchange rate refresh cron started (daily 02:00)");

  // Fetch rate once on startup
  refreshBrlUsdRate().catch(() => {});
}

export function stopPayoutCron(): void {
  if (task) { task.stop(); task = null; }
  if (rateTask) { rateTask.stop(); rateTask = null; }
}

/** Sync payouts that are stuck in processing/awaiting_confirmation with NowPayments. */
async function syncStuckPayouts(): Promise<void> {
  const stuck = await db.select().from(partnerPayoutsTable)
    .where(eq(partnerPayoutsTable.status, "processing"));
  const awaiting = await db.select().from(partnerPayoutsTable)
    .where(eq(partnerPayoutsTable.status, "awaiting_confirmation"));
  const all = [...stuck, ...awaiting];

  for (const payout of all) {
    if (!payout.providerPayoutId) continue;
    try {
      const np = await getPayout(Number(payout.providerPayoutId));
      const mapped = mapPayoutStatus(np.status);
      if (mapped === "completed" || mapped === "failed") {
        await processPayoutWebhook(String(np.id), np.status, np.tx_hash);
        logger.info({ payoutId: payout.id, npStatus: np.status }, "Stuck payout synced & finalized");
      } else if (np.status !== payout.providerStatus) {
        await db.update(partnerPayoutsTable).set({ providerStatus: np.status }).where(eq(partnerPayoutsTable.id, payout.id));
      }
    } catch (err) {
      logger.warn({ err, payoutId: payout.id }, "Failed to sync stuck payout");
    }
  }
}

/** Retry auto-payout for partners whose balanceDue >= minPayout but have no pending payout. */
async function retryPendingAutoPayouts(): Promise<void> {
  const partners = await db.select().from(partnersTable)
    .where(eq(partnersTable.status, "active"));
  for (const p of partners) {
    const balance = Number(p.balanceDue);
    const min = Number(p.minPayout);
    const pending = Number(p.pendingPayout);
    if (p.autoPayout && balance >= min && pending === 0) {
      await triggerAutoPayout(p.id).catch((err) => {
        logger.error({ err, partnerId: p.id }, "Retry auto-payout failed");
      });
    }
  }
}
