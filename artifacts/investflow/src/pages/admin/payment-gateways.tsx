import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Save, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api";

interface GatewayConfig {
  nowpayments: { enabled: boolean; apiKeyConfigured: boolean; ipnSecretConfigured: boolean; baseUrl: string; priceCurrency: string; };
  mercadopago: { enabled: boolean; accessTokenConfigured: boolean; baseUrl: string; };
  partnerSplitEnabled: boolean;
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminPaymentGateways() {
  return <PaymentGatewaysContent embedded />;
}

export function PaymentGatewaysContent({ embedded = false }: { embedded?: boolean }) {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — secrets are write-only (shown empty unless user types a new value)
  const [form, setForm] = useState({
    nowpaymentsEnabled: false,
    nowpaymentsApiKey: "",
    nowpaymentsIpnSecret: "",
    nowpaymentsBaseUrl: "https://api.nowpayments.io/v1",
    nowpaymentsPriceCurrency: "BRL",
    mercadopagoEnabled: false,
    mercadopagoAccessToken: "",
    mercadopagoWebhookSecret: "",
    mercadopagoBaseUrl: "https://api.mercadopago.com/v1",
    partnerSplitEnabled: true,
  });

  useEffect(() => {
    apiGet<GatewayConfig>("/api/admin/payment-gateways")
      .then((c) => {
        setConfig(c);
        setForm((f) => ({
          ...f,
          nowpaymentsEnabled: c.nowpayments.enabled,
          nowpaymentsBaseUrl: c.nowpayments.baseUrl,
          nowpaymentsPriceCurrency: c.nowpayments.priceCurrency,
          mercadopagoEnabled: c.mercadopago.enabled,
          mercadopagoBaseUrl: c.mercadopago.baseUrl,
          partnerSplitEnabled: c.partnerSplitEnabled,
        }));
      })
      .catch(() => toast.error("Erro ao carregar configuração"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send secrets if user typed something (non-empty) — avoids wiping existing
      const body: Record<string, unknown> = {
        nowpaymentsEnabled: form.nowpaymentsEnabled,
        nowpaymentsBaseUrl: form.nowpaymentsBaseUrl,
        nowpaymentsPriceCurrency: form.nowpaymentsPriceCurrency,
        mercadopagoEnabled: form.mercadopagoEnabled,
        mercadopagoBaseUrl: form.mercadopagoBaseUrl,
        partnerSplitEnabled: form.partnerSplitEnabled,
      };
      if (form.nowpaymentsApiKey.trim()) body.nowpaymentsApiKey = form.nowpaymentsApiKey.trim();
      if (form.nowpaymentsIpnSecret.trim()) body.nowpaymentsIpnSecret = form.nowpaymentsIpnSecret.trim();
      if (form.mercadopagoAccessToken.trim()) body.mercadopagoAccessToken = form.mercadopagoAccessToken.trim();
      if (form.mercadopagoWebhookSecret.trim()) body.mercadopagoWebhookSecret = form.mercadopagoWebhookSecret.trim();

      await apiPatch<GatewayConfig>("/api/admin/settings", body);
      const refreshed = await apiGet<GatewayConfig>("/api/admin/payment-gateways");
      setConfig(refreshed);
      // Clear secret fields after save
      setForm((f) => ({ ...f, nowpaymentsApiKey: "", nowpaymentsIpnSecret: "", mercadopagoAccessToken: "", mercadopagoWebhookSecret: "" }));
      toast.success("Configuração salva com sucesso");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada");
  };

  // Verificação de capacidade de payout (saldo + 2FA)
  const [payoutStatus, setPayoutStatus] = useState<any>(null);
  const [checkingPayout, setCheckingPayout] = useState(false);
  const checkPayoutStatus = async () => {
    setCheckingPayout(true);
    try {
      const result = await apiGet<any>("/api/admin/nowpayments/payout-status");
      setPayoutStatus(result);
    } catch (e: any) {
      setPayoutStatus({ payoutsEnabled: false, reason: e?.message || "Erro ao verificar" });
    } finally {
      setCheckingPayout(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Gateways de Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure NowPayments (cripto) e Mercado Pago (PIX). As confirmações são automáticas via webhook.
          </p>
        </div>
      )}

      {/* ─── NowPayments ─── */}
      <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "24px" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-amber-400">NowPayments</h2>
            <p className="text-xs text-muted-foreground">Cripto: BTC, USDT, USDC, BNB, ETH, etc.</p>
          </div>
          <div className="flex items-center gap-2">
            {config?.nowpayments.apiKeyConfigured ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> API Key OK</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30"><XCircle className="h-3 w-3 mr-1" /> Sem API Key</Badge>
            )}
            {config?.nowpayments.ipnSecretConfigured ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> IPN OK</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30"><XCircle className="h-3 w-3 mr-1" /> Sem IPN</Badge>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.nowpaymentsEnabled} onChange={(e) => setForm({ ...form, nowpaymentsEnabled: e.target.checked })} className="h-4 w-4" />
            <span className="text-sm">Habilitar NowPayments</span>
          </label>
          <Field label="API Key" value={form.nowpaymentsApiKey} onChange={(v) => setForm({ ...form, nowpaymentsApiKey: v })} placeholder={config?.nowpayments.apiKeyConfigured ? "•••••• (preenchido — digite para trocar)" : "Cole sua API Key do NowPayments"} type="password" />
          <Field label="IPN Secret" value={form.nowpaymentsIpnSecret} onChange={(v) => setForm({ ...form, nowpaymentsIpnSecret: v })} placeholder={config?.nowpayments.ipnSecretConfigured ? "•••••• (preenchido — digite para trocar)" : "IPN secret (Account → IPN secret)"} type="password" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base URL" value={form.nowpaymentsBaseUrl} onChange={(v) => setForm({ ...form, nowpaymentsBaseUrl: v })} />
            <Field label="Moeda do preço" value={form.nowpaymentsPriceCurrency} onChange={(v) => setForm({ ...form, nowpaymentsPriceCurrency: v })} placeholder="BRL" />
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <span className="text-xs text-muted-foreground flex-1 font-mono">{window.location.origin}/api/payments/webhook/nowpayments</span>
            <Button size="sm" variant="ghost" onClick={() => copyWebhookUrl("/api/payments/webhook/nowpayments")}><Copy className="h-3 w-3 mr-1" /> Copiar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Configure esta URL em NowPayments → Account Settings → IPN callback URL.</p>
        </div>

        {/* Verificação de payout (2FA + email) */}
        <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold">Payouts (pagar sócios / saques cripto)</p>
              <p className="text-[10px] text-muted-foreground">NowPayments exige email + 2FA configurados na conta para permitir payouts via API.</p>
            </div>
            <Button size="sm" variant="outline" onClick={checkPayoutStatus} disabled={checkingPayout}>
              {checkingPayout ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {checkingPayout ? "Verificando..." : "Verificar"}
            </Button>
          </div>
          {payoutStatus && (
            <div className="text-xs">
              {payoutStatus.payoutsEnabled ? (
                <div>
                  <p className="text-emerald-400 font-medium mb-1">✓ Payouts habilitados</p>
                  {payoutStatus.balances && Object.keys(payoutStatus.balances).length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Saldos disponíveis:</p>
                      {Object.entries(payoutStatus.balances).map(([cur, amt]: [string, any]) => (
                        <p key={cur} className="font-mono">{cur}: {Number(amt).toFixed(8)}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-amber-400 mt-2">⚠ Cada payout via API gera um código por email — confirme na aba Sócios & Split (seção 2FA).</p>
                </div>
              ) : (
                <p className="text-red-400 font-medium">✗ {payoutStatus.reason || "Payouts não habilitados"}</p>
              )}
            </div>
          )}
          {!payoutStatus && (
            <p className="text-[10px] text-muted-foreground">Clique em "Verificar" para checar se a conta está habilitada para payouts e ver os saldos.</p>
          )}
        </div>
      </div>

      {/* ─── Mercado Pago ─── */}
      <div style={{ background: "#111827", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "16px", padding: "24px" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-emerald-400">Mercado Pago (PIX)</h2>
            <p className="text-xs text-muted-foreground">PIX com QR Code dinâmico — confirmação instantânea.</p>
          </div>
          <div className="flex items-center gap-2">
            {config?.mercadopago.accessTokenConfigured ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Token OK</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30"><XCircle className="h-3 w-3 mr-1" /> Sem Token</Badge>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.mercadopagoEnabled} onChange={(e) => setForm({ ...form, mercadopagoEnabled: e.target.checked })} className="h-4 w-4" />
            <span className="text-sm">Habilitar Mercado Pago (PIX)</span>
          </label>
          <Field label="Access Token" value={form.mercadopagoAccessToken} onChange={(v) => setForm({ ...form, mercadopagoAccessToken: v })} placeholder={config?.mercadopago.accessTokenConfigured ? "•••••• (preenchido — digite para trocar)" : "APP_USR-... (Mercado Pago → Suas integrações → Credenciais)"} type="password" />
          <Field label="Webhook Secret (opcional)" value={form.mercadopagoWebhookSecret} onChange={(v) => setForm({ ...form, mercadopagoWebhookSecret: v })} placeholder="Secret de validação do webhook (configurável no MP)" type="password" />
          <Field label="Base URL" value={form.mercadopagoBaseUrl} onChange={(v) => setForm({ ...form, mercadopagoBaseUrl: v })} />
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <span className="text-xs text-muted-foreground flex-1 font-mono">{window.location.origin}/api/payments/webhook/mercadopago</span>
            <Button size="sm" variant="ghost" onClick={() => copyWebhookUrl("/api/payments/webhook/mercadopago")}><Copy className="h-3 w-3 mr-1" /> Copiar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Configure esta URL em Mercado Pago → Suas integrações → Webhooks. Eventos: <code>payment</code>.</p>
        </div>
      </div>

      {/* ─── Split de Sócios ─── */}
      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Split de Sócios</h2>
            <p className="text-xs text-muted-foreground">Distribui automaticamente uma % de cada pagamento confirmado entre os sócios ativos.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.partnerSplitEnabled} onChange={(e) => setForm({ ...form, partnerSplitEnabled: e.target.checked })} className="h-4 w-4" />
            <span className="text-sm">{form.partnerSplitEnabled ? "Ativo" : "Inativo"}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Cadastre os sócios e suas porcentagens na aba <b>Sócios & Split</b>.</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base font-bold">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar Configuração"}
      </Button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
