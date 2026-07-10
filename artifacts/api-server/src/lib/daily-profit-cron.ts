import cron from "node-cron";
import { logger } from "./logger";
import { executeDailyProfit } from "../routes/daily-profit";

let task: cron.ScheduledTask | null = null;

/**
 * Cron que roda a cada minuto e verifica se alguma posição ativa completou 24h
 * desde a última vez que recebeu rendimento (ou desde a compra). Se sim, credita
 * o rendimento automaticamente. 100% automático — sem horário fixo, sem dias da
 * semana, sem intervenção humana.
 */
export function startDailyProfitCron(): void {
  if (task) {
    task.stop();
  }

  task = cron.schedule("* * * * *", async () => {
    try {
      const result = await executeDailyProfit();
      if (result.processed > 0 || result.errors > 0) {
        logger.info(result, "Daily profit cron: execution result");
      }
    } catch (err) {
      logger.error({ err }, "Daily profit cron: unhandled error");
    }
  });

  logger.info("Daily profit cron started (24h cycle per position, checks every minute)");
}

export function stopDailyProfitCron(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info("Daily profit cron stopped");
  }
}
