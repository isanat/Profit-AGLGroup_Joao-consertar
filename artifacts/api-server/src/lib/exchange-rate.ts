import { getSetting, setSetting } from "./settings";
import { logger } from "./logger";

/**
 * Get the BRL→USD rate (1 BRL = X USD) from the cached setting.
 * The rate is refreshed daily by refreshBrlUsdRate() via the BCB API.
 */
export async function getBrlUsdRate(): Promise<number> {
  const raw = await getSetting("brlUsdRate");
  const rate = Number(raw);
  if (!rate || rate <= 0 || rate > 1) return 0.18; // sane fallback (~5.55 BRL/USD)
  return rate;
}

/**
 * Convert a BRL amount to USD using the cached rate.
 */
export async function brlToUsd(brlAmount: number): Promise<number> {
  const rate = await getBrlUsdRate();
  return parseFloat((brlAmount * rate).toFixed(8));
}

/**
 * Convert a deposit amount to USD. Handles BRL and USD price currencies.
 */
export async function depositToUsd(amount: number, currency: string): Promise<number> {
  const c = (currency || "BRL").toUpperCase();
  if (c === "USD") return parseFloat(amount.toFixed(8));
  if (c === "BRL") return brlToUsd(amount);
  // For other currencies, assume amount is already close to USD (best-effort)
  // In production you'd fetch a proper rate; here we use BRL rate as fallback.
  return brlToUsd(amount);
}

/**
 * Fetch the current BRL→USD rate from the Brazilian Central Bank (BCB) PTAX API
 * and cache it in the settings table. Free, no API key required.
 * Runs daily via cron.
 */
export async function refreshBrlUsdRate(): Promise<number> {
  try {
    // BCB OLinda API — cotacao do dolar (PTAX)
    // Returns the most recent USD→BRL rate
    const today = new Date().toISOString().slice(0, 10);
    // Format MM-DD-YYYY for the API
    const [y, m, d] = today.split("-");
    const dateParam = `${m}-${d}-${y}`;

    // Try today, fallback to yesterday if not available yet
    for (const offset of [0, 1, 2]) {
      const dt = new Date();
      dt.setDate(dt.getDate() - offset);
      const dp = `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}-${dt.getFullYear()}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dp}'&$top=1&$format=json`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) continue;
      const data = await resp.json() as { value: { cotacaoVenda: number }[] };
      if (data.value && data.value.length > 0) {
        const usdBrl = data.value[0].cotacaoVenda; // 1 USD = X BRL
        const brlUsd = 1 / usdBrl; // 1 BRL = X USD
        const rounded = parseFloat(brlUsd.toFixed(6));
        await setSetting("brlUsdRate", String(rounded));
        logger.info({ usdBrl, brlUsd: rounded }, "BRL→USD rate refreshed from BCB");
        return rounded;
      }
    }
    logger.warn("BCB API returned no rate data — keeping existing rate");
    return await getBrlUsdRate();
  } catch (err) {
    logger.error({ err }, "Failed to refresh BRL→USD rate from BCB");
    return await getBrlUsdRate();
  }
}
