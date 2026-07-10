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
  // ── Identidade do site ────────────────────────────────────────────────────
  siteName: "Alliance Group",
  siteLogoUrl: "/logo.png",
  // ── Suporte / Contato ──────────────────────────────────────────────────────
  supportWhatsapp: "",
  supportEmail: "",
  supportPhone: "",
  supportTelegram: "",
  // ── Payment gateways ──────────────────────────────────────────────────────
  nowpaymentsEnabled: "false",
  nowpaymentsApiKey: "",
  nowpaymentsIpnSecret: "",
  nowpayments2faSecret: "",
  // Email + senha da conta NowPayments — necessários para autenticar (JWT) e
  // buscar as moedas habilitadas pelo merchant via GET /merchant/coins.
  nowpaymentsEmail: "",
  nowpaymentsPassword: "",
  nowpaymentsBaseUrl: "https://api.nowpayments.io/v1",
  nowpaymentsPriceCurrency: "BRL",
  mercadopagoEnabled: "false",
  mercadopagoAccessToken: "",
  mercadopagoWebhookSecret: "",
  mercadopagoBaseUrl: "https://api.mercadopago.com/v1",
  // ── Partner split ─────────────────────────────────────────────────────────
  // Se true, todo pagamento confirmado via gateway é dividido entre sócios ativos
  partnerSplitEnabled: "true",
  // Taxa BRL→USD para conversão do split (1 BRL = X USD). Atualizada via cron do BCB.
  brlUsdRate: "0.18",
  // ── Auto-approval de saques ───────────────────────────────────────────────
  // Se true, saques abaixo do limite são aprovados automaticamente (cron 10 min)
  withdrawalAutoApproveEnabled: "false",
  // Valor máximo (em BRL) para auto-aprovação. Acima disso exige aprovação manual.
  withdrawalAutoApproveLimit: "500",
  // Quantos dias desde o cadastro o usuário deve ter para ser elegível a auto-aprovação
  withdrawalAutoApproveMinAccountAgeDays: "7",
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
    nowpayments2faSecretConfigured: Boolean(result.nowpayments2faSecret),
    nowpaymentsEmailConfigured: Boolean(result.nowpaymentsEmail),
    nowpaymentsPasswordConfigured: Boolean(result.nowpaymentsPassword),
    mercadopagoEnabled: result.mercadopagoEnabled === "true",
    mercadopagoBaseUrl: String(result.mercadopagoBaseUrl),
    mercadopagoAccessTokenConfigured: Boolean(result.mercadopagoAccessToken),
    partnerSplitEnabled: result.partnerSplitEnabled !== "false",
    brlUsdRate: Number(result.brlUsdRate),
    withdrawalAutoApproveEnabled: result.withdrawalAutoApproveEnabled === "true",
    withdrawalAutoApproveLimit: Number(result.withdrawalAutoApproveLimit),
    withdrawalAutoApproveMinAccountAgeDays: Number(result.withdrawalAutoApproveMinAccountAgeDays),
    // Identidade do site
    siteName: String(result.siteName || "Alliance Group"),
    siteLogoUrl: String(result.siteLogoUrl || "/logo.png"),
    // Suporte
    supportWhatsapp: String(result.supportWhatsapp || ""),
    supportEmail: String(result.supportEmail || ""),
    supportPhone: String(result.supportPhone || ""),
    supportTelegram: String(result.supportTelegram || ""),
  };
}

/**
 * Returns public site config (name, logo, support) — sem auth, usado no layout.
 */
export async function getPublicSiteConfig(): Promise<{
  siteName: string;
  siteLogoUrl: string;
  supportWhatsapp: string;
  supportEmail: string;
  supportPhone: string;
  supportTelegram: string;
}> {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = { ...defaultSettings };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return {
    siteName: String(result.siteName || "Alliance Group"),
    siteLogoUrl: String(result.siteLogoUrl || "/logo.png"),
    supportWhatsapp: String(result.supportWhatsapp || ""),
    supportEmail: String(result.supportEmail || ""),
    supportPhone: String(result.supportPhone || ""),
    supportTelegram: String(result.supportTelegram || ""),
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
