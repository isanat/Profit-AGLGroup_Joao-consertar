import { useState, useEffect } from "react";

export interface SiteConfig {
  siteName: string;
  siteLogoUrl: string;
  supportWhatsapp: string;
  supportEmail: string;
  supportPhone: string;
  supportTelegram: string;
}

let _cache: SiteConfig | null = null;

/** Limpa o cache do site-config (chamar após alterar nome/logo no admin) */
export function clearSiteConfigCache(): void {
  _cache = null;
}

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig | null>(_cache);
  const [loading, setLoading] = useState(!_cache);

  const reload = () => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((data) => {
        _cache = data;
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        const fallback: SiteConfig = {
          siteName: "Alliance Group",
          siteLogoUrl: "/logo.png",
          supportWhatsapp: "",
          supportEmail: "",
          supportPhone: "",
          supportTelegram: "",
        };
        _cache = fallback;
        setConfig(fallback);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (_cache) return;
    reload();
  }, []);

  return { config, loading, reload };
}

export function getSiteConfig(): SiteConfig | null {
  return _cache;
}
