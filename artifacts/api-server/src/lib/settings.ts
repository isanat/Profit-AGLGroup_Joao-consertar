import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const defaultSettings: Record<string, string> = {
  withdrawalFeePercent: "2",
  minWithdrawal: "10",
  maxWithdrawal: "100000",
  minDeposit: "10",
  referralCommissionPercent: "100",
  referralLevels: "1",
  maintenanceMode: "false",
  depositEnabled: "true",
  withdrawalEnabled: "true",
  // ── Payment gateways ──────────────────────────────────────────────────────
  nowpaymentsEnabled: "false",
  nowpaymentsApiKey: "",
  nowpaymentsIpnSecret: "",
  nowpaymentsBaseUrl: "https://api.nowpayments.io/v1",
  nowpaymentsPriceCurrency: "BRL",
  mercadopagoEnabled: "false",
  mercadopagoAccessToken: "",
  mercadopagoWebhookSecret: "",
  mercadopagoBaseUrl: "https://api.mercadopago.com/v1",
  // ── Partner split ─────────────────────────────────────────────────────────
  // Se true, todo pagamento confirmado via gateway é dividido entre sócios ativos
  partnerSplitEnabled: "true",
  // % mínima que fica na plataforma (sócios dividem o resto proporcionalmente).
  // Se a soma dos splitPercent dos sócios < 100, o restante fica na plataforma.
  // Se a soma > 100, é normalizado proporcionalmente.
};

export async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? defaultSettings[key] ?? "";
}

export async function getAllSettings(): Promise<Record<string, string | number | boolean>> {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string | number | boolean> = { ...defaultSettings };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return {
    withdrawalFeePercent: Number(result.withdrawalFeePercent),
    minWithdrawal: Number(result.minWithdrawal),
    maxWithdrawal: Number(result.maxWithdrawal),
    minDeposit: Number(result.minDeposit),
    referralCommissionPercent: Number(result.referralCommissionPercent),
    referralLevels: Number(result.referralLevels),
    maintenanceMode: result.maintenanceMode === "true",
    depositEnabled: result.depositEnabled !== "false",
    withdrawalEnabled: result.withdrawalEnabled !== "false",
    // Payment gateways (NUNCA retornar os secrets no payload público — tratados no admin)
    nowpaymentsEnabled: result.nowpaymentsEnabled === "true",
    nowpaymentsBaseUrl: String(result.nowpaymentsBaseUrl),
    nowpaymentsPriceCurrency: String(result.nowpaymentsPriceCurrency),
    nowpaymentsApiKeyConfigured: Boolean(result.nowpaymentsApiKey),
    nowpaymentsIpnSecretConfigured: Boolean(result.nowpaymentsIpnSecret),
    mercadopagoEnabled: result.mercadopagoEnabled === "true",
    mercadopagoBaseUrl: String(result.mercadopagoBaseUrl),
    mercadopagoAccessTokenConfigured: Boolean(result.mercadopagoAccessToken),
    partnerSplitEnabled: result.partnerSplitEnabled !== "false",
  };
}

/**
 * Returns the full secret settings (only for server-side use, never expose to client).
 */
export async function getSecretSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = { ...defaultSettings };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing) {
    await db.update(settingsTable).set({ value }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}
