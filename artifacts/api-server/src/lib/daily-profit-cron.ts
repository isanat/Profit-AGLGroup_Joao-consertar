import cron from "node-cron";
import { logger } from "./logger";
import { executeDailyProfit } from "../routes/daily-profit";

let task: cron.ScheduledTask | null = null;

/** Start a cron that fires every minute and internally decides whether to run */
export function startDailyProfitCron(): void {
  if (task) {
    task.stop();
  }

  // Run every minute; execution logic checks if configured time and day match
  task = cron.schedule("* * * * *", async () => {
    try {
      const result = await executeDailyProfit({ isManual: false });
      if (result.processed > 0 || result.errors > 0) {
        logger.info(result, "Daily profit cron: execution result");
      }
    } catch (err) {
      logger.error({ err }, "Daily profit cron: unhandled error");
    }
  });

  logger.info("Daily profit cron started (checks every minute)");
}

export function stopDailyProfitCron(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info("Daily profit cron stopped");
  }
}
