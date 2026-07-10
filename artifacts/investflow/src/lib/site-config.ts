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

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig | null>(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
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
  }, []);

  return { config, loading };
}

export function getSiteConfig(): SiteConfig | null {
  return _cache;
}
