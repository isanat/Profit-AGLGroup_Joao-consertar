import {
  db,
  usersTable,
  strategiesTable,
  strategyPerformanceTable,
  platformWalletsTable,
  settingsTable,
  notificationsTable,
  dailyProfitSettingsTable,
  dailyProfitDaysTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Upsert admin user
  const adminHash = await bcrypt.hash("Admin@123456", 12);
  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.email, "admin@investflow.com"));
  let admin = existingAdmin;
  if (!admin) {
    const [a] = await db.insert(usersTable).values({
      name: "Admin InvestFlow",
      email: "admin@investflow.com",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
      emailVerified: true,
      referralCode: "ADMIN001",
      balance: "10000",
    }).returning();
    admin = a;
    console.log("✅ Admin user created:", admin.email);
  } else {
    console.log("ℹ️  Admin user already exists:", admin.email);
  }

  // 2. Demo user
  const userHash = await bcrypt.hash("Demo@123456", 12);
  const [existingDemo] = await db.select().from(usersTable).where(eq(usersTable.email, "demo@investflow.com"));
  let demoUser = existingDemo;
  if (!demoUser) {
    const [u] = await db.insert(usersTable).values({
      name: "João Silva",
      email: "demo@investflow.com",
      passwordHash: userHash,
      phone: "+55 11 99999-9999",
      country: "BR",
      role: "user",
      status: "active",
      emailVerified: true,
      referralCode: "DEMO001",
      referredBy: admin.id,
      balance: "5000",
      totalInvested: "10000",
      totalYield: "1250",
    }).returning();
    demoUser = u;
    console.log("✅ Demo user created:", demoUser.email);
  } else {
    console.log("ℹ️  Demo user already exists:", demoUser.email);
  }

  // 3. Strategies
  const strategies = [
    {
      name: "Alpha Momentum BTC",
      description: "Estratégia quantitativa de momentum aplicada ao Bitcoin com gerenciamento de risco avançado. Utiliza análise técnica e fundamentos para identificar tendências de curto e médio prazo.",
      riskLevel: "high" as const,
      category: "Cripto",
      minInvestment: "500",
      totalShares: 500,
      availableShares: 320,
      sharePrice: "1250.00",
      aum: "225000",
      maxDrawdown: "22.5",
      totalReturnPct: "187.4",
      monthlyReturnPct: "8.2",
      dailyProfitPercent: "0.27", // ~8.2% / 30 days
      status: "active" as const,
      startDate: "2023-01-15",
    },
    {
      name: "Verde Capital Multi",
      description: "Fundo multimercado diversificado com exposição a renda fixa, ações e câmbio. Gestão ativa com foco em preservação de capital e retorno consistente.",
      riskLevel: "medium" as const,
      category: "Multimercado",
      minInvestment: "1000",
      totalShares: 1000,
      availableShares: 650,
      sharePrice: "148.75",
      aum: "520000",
      maxDrawdown: "8.3",
      totalReturnPct: "48.75",
      monthlyReturnPct: "2.1",
      dailyProfitPercent: "0.07", // ~2.1% / 30 days
      status: "active" as const,
      startDate: "2022-06-01",
    },
    {
      name: "Renda Fixa Plus",
      description: "Estratégia conservadora com foco em instrumentos de renda fixa de alta qualidade. Ideal para investidores que buscam preservação de capital com retorno previsível acima do CDI.",
      riskLevel: "low" as const,
      category: "Renda Fixa",
      minInvestment: "100",
      totalShares: 2000,
      availableShares: 1200,
      sharePrice: "112.30",
      aum: "894000",
      maxDrawdown: "1.2",
      totalReturnPct: "12.30",
      monthlyReturnPct: "0.92",
      dailyProfitPercent: "0.03", // ~0.92% / 30 days
      status: "active" as const,
      startDate: "2021-03-01",
    },
    {
      name: "Tech Disruptors",
      description: "Exposição a empresas de tecnologia disruptiva globais. Concentração em semicondutores, IA e cloud computing com hedge cambial parcial.",
      riskLevel: "high" as const,
      category: "Ações",
      minInvestment: "500",
      totalShares: 800,
      availableShares: 445,
      sharePrice: "234.80",
      aum: "382000",
      maxDrawdown: "31.5",
      totalReturnPct: "134.8",
      monthlyReturnPct: "5.6",
      dailyProfitPercent: "0.19", // ~5.6% / 30 days
      status: "active" as const,
      startDate: "2022-01-10",
    },
    {
      name: "Arbitragem Digital",
      description: "Fundo focado em arbitragem entre exchanges de criptomoedas e derivativos digitais. Estratégia market neutral com baixa correlação com mercado tradicional.",
      riskLevel: "medium" as const,
      category: "Cripto",
      minInvestment: "300",
      totalShares: 600,
      availableShares: 180,
      sharePrice: "178.50",
      aum: "750000",
      maxDrawdown: "5.8",
      totalReturnPct: "78.5",
      monthlyReturnPct: "3.4",
      dailyProfitPercent: "0.11", // ~3.4% / 30 days
      status: "active" as const,
      startDate: "2022-09-15",
    },
    {
      name: "Global Macro BR",
      description: "Estratégia macro global com foco em oportunidades do mercado brasileiro. Opera juros, câmbio e commodities com visão top-down.",
      riskLevel: "medium" as const,
      category: "Multimercado",
      minInvestment: "1000",
      totalShares: 400,
      availableShares: 400,
      sharePrice: "100.00",
      aum: "0",
      maxDrawdown: "0",
      totalReturnPct: "0",
      monthlyReturnPct: "0",
      dailyProfitPercent: "0.15",
      status: "paused" as const,
      startDate: "2024-01-01",
    },
  ];

  for (const strat of strategies) {
    const [existing] = await db.select().from(strategiesTable).where(eq(strategiesTable.name, strat.name));
    // Update dailyProfitPercent for existing strategies if it's 0 (backfill)
    if (existing && Number(existing.dailyProfitPercent) === 0 && strat.dailyProfitPercent) {
      await db.update(strategiesTable).set({ dailyProfitPercent: strat.dailyProfitPercent })
        .where(eq(strategiesTable.id, existing.id));
      console.log(`✅ Strategy dailyProfitPercent updated: ${strat.name} = ${strat.dailyProfitPercent}%`);
    }
    if (!existing) {
      const [s] = await db.insert(strategiesTable).values(strat).returning();
      // Seed 12 months of performance history
      const basePrice = Number(strat.sharePrice) * 0.5;
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const progress = (11 - i) / 11;
        const val = basePrice + (Number(strat.sharePrice) - basePrice) * progress * (1 + (Math.random() * 0.1 - 0.05));
        const monthYield = i === 0 ? Number(strat.monthlyReturnPct) : (Math.random() * 3 + 0.5);
        await db.insert(strategyPerformanceTable).values({
          strategyId: s.id,
          date: d.toISOString().slice(0, 10),
          value: val.toFixed(2),
          yieldAmount: (val * monthYield / 100).toFixed(2),
          yieldPercentage: monthYield.toFixed(4),
          description: `Rentabilidade mensal - ${d.toISOString().slice(0, 7)}`,
          appliedBy: admin.id,
        });
      }
      console.log("✅ Strategy created:", s.name);
    } else {
      console.log("ℹ️  Strategy already exists:", strat.name);
    }
  }

  // 4. Platform wallets
  const wallets = [
    { method: "pix", label: "PIX (CPF/CNPJ)", address: "investflow@pix.com.br", instructions: "Faça o PIX para a chave acima e envie o comprovante. O crédito será realizado em até 1 hora útil após confirmação." },
    { method: "usdt_bep20", label: "USDT BEP20 (BSC)", address: "0x742d35Cc6634C0532925a3b8D4C9f5d2E3a1B2c3", instructions: "Envie USDT na rede BSC (BEP20) para o endereço acima. Confirmações necessárias: 15 blocos." },
    { method: "bitcoin", label: "Bitcoin (BTC)", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", instructions: "Envie BTC para o endereço acima. Confirmações necessárias: 3 blocos (aprox. 30 minutos)." },
    { method: "usdc", label: "USDC BEP20 (BSC)", address: "0x742d35Cc6634C0532925a3b8D4C9f5d2E3a1B2c3", instructions: "Envie USDC na rede BSC (BEP20). Confirmações necessárias: 15 blocos." },
    { method: "bnb", label: "BNB (BSC)", address: "0x742d35Cc6634C0532925a3b8D4C9f5d2E3a1B2c3", instructions: "Envie BNB na rede BSC para o endereço acima. Confirmações necessárias: 15 blocos." },
  ];

  for (const w of wallets) {
    const [existing] = await db.select().from(platformWalletsTable).where(eq(platformWalletsTable.method, w.method));
    if (!existing) {
      await db.insert(platformWalletsTable).values(w);
      console.log("✅ Wallet created:", w.method);
    }
  }

  // 5. Default settings
  const defaultSettings = [
    { key: "withdrawalFeePercent", value: "2" },
    { key: "minWithdrawal", value: "10" },
    { key: "maxWithdrawal", value: "100000" },
    { key: "minDeposit", value: "10" },
    { key: "referralCommissionPercent", value: "5" },
    { key: "referralLevels", value: "1" },
    { key: "maintenanceMode", value: "false" },
    { key: "depositEnabled", value: "true" },
    { key: "withdrawalEnabled", value: "true" },
    // Payment gateways (off by default — admin configures keys)
    { key: "nowpaymentsEnabled", value: "false" },
    { key: "nowpaymentsApiKey", value: "" },
    { key: "nowpaymentsIpnSecret", value: "" },
    { key: "nowpayments2faSecret", value: "" },
    { key: "nowpaymentsAcceptedCurrencies", value: "" },
    { key: "nowpaymentsBaseUrl", value: "https://api.nowpayments.io/v1" },
    { key: "nowpaymentsPriceCurrency", value: "BRL" },
    { key: "mercadopagoEnabled", value: "false" },
    { key: "mercadopagoAccessToken", value: "" },
    { key: "mercadopagoWebhookSecret", value: "" },
    { key: "mercadopagoBaseUrl", value: "https://api.mercadopago.com/v1" },
    { key: "partnerSplitEnabled", value: "true" },
    { key: "brlUsdRate", value: "0.18" },
    // Auto-approval de saques (off by default — admin habilita quando quiser)
    { key: "withdrawalAutoApproveEnabled", value: "false" },
    { key: "withdrawalAutoApproveLimit", value: "500" },
    { key: "withdrawalAutoApproveMinAccountAgeDays", value: "7" },
  ];

  for (const s of defaultSettings) {
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, s.key));
    if (!existing) {
      await db.insert(settingsTable).values(s);
      console.log("✅ Setting:", s.key, "=", s.value);
    }
  }

  // 6. Configure daily profit to run automatically every day at 18:00 (1% default)
  const [existingDpSettings] = await db.select().from(dailyProfitSettingsTable).limit(1);
  if (!existingDpSettings) {
    const [dpSettings] = await db.insert(dailyProfitSettingsTable).values({
      percentage: "1",
      executionTime: "18:00",
      active: true,
    }).returning();
    // Enable all 7 days of the week (0=Sun..6=Sat) so it runs every day
    for (let dow = 0; dow <= 6; dow++) {
      await db.insert(dailyProfitDaysTable).values({ settingId: dpSettings.id, dayOfWeek: dow });
    }
    console.log("✅ Daily profit settings created (1% daily at 18:00, all days)");
  } else {
    // Ensure at least some days are configured — if none, add all 7
    const days = await db.select().from(dailyProfitDaysTable)
      .where(eq(dailyProfitDaysTable.settingId, existingDpSettings.id));
    if (days.length === 0) {
      for (let dow = 0; dow <= 6; dow++) {
        await db.insert(dailyProfitDaysTable).values({ settingId: existingDpSettings.id, dayOfWeek: dow });
      }
      console.log("✅ Daily profit: added all days (was empty)");
    }
  }

  // 7. Welcome notification for demo user
  const [existingNotif] = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, demoUser.id));
  if (!existingNotif) {
    await db.insert(notificationsTable).values({
      userId: demoUser.id,
      title: "Bem-vindo ao InvestFlow!",
      message: "Sua conta foi criada com sucesso. Explore nossas estratégias de investimento e comece a rentabilizar seu capital hoje mesmo.",
      type: "success",
    });
    console.log("✅ Welcome notification sent");
  }

  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("   Admin: admin@investflow.com / Admin@123456");
  console.log("   Demo:  demo@investflow.com  / Demo@123456");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
