import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getPublicSiteConfig } from "../lib/settings";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /site-config — público (sem auth), retorna nome do site, logo e contatos de suporte
router.get("/site-config", async (_req, res) => {
  try {
    const config = await getPublicSiteConfig();
    res.json(config);
  } catch {
    res.json({
      siteName: "Alliance Group",
      siteLogoUrl: "/logo.png",
      supportWhatsapp: "",
      supportEmail: "",
      supportPhone: "",
      supportTelegram: "",
    });
  }
});

export default router;
