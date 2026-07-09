import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, Wallet, ArrowLeft, Loader2, Clock, ExternalLink, QrCode } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PaymentConfig {
  nowpayments: {
    enabled: boolean;
    priceCurrency: string;
    currencies: { code: string; label: string; network: string }[];
  };
  mercadopago: {
    enabled: boolean;
    methods: { code: string; label: string }[];
  };
  minDeposit: number;
}

interface Invoice {
  id: number;
  provider: "nowpayments" | "mercadopago";
  providerInvoiceId: string | null;
  providerStatus: string | null;
  status: "pending" | "confirming" | "confirmed" | "expired" | "failed";
  amountRequested: number;
  priceCurrency: string;
  payCurrency: string | null;
  payAmount: number | null;
  payAddress: string | null;
  payUrl: string | null;
  qrCodeUrl: string | null;
  pixPayload: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

type MethodOption =
  | { kind: "nowpayments"; code: string; label: string; network: string }
  | { kind: "mercadopago"; code: string; label: string };

export default function Deposit() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<MethodOption | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Load payment config
  useEffect(() => {
    apiGet<PaymentConfig>("/api/payments/config")
      .then(setConfig)
      .catch((e) => toast.error("Falha ao carregar métodos de pagamento"))
      .finally(() => setLoading(false));
  }, []);

  // Poll invoice status
  const pollInvoice = useCallback(async (invoiceId: number) => {
    try {
      const inv = await apiGet<Invoice>(`/api/payments/${invoiceId}`);
      setInvoice(inv);
      if (inv.status === "confirmed") {
        toast.success("Depósito confirmado! Saldo creditado.");
        return true;
      }
      if (inv.status === "expired" || inv.status === "failed") {
        toast.error(inv.status === "expired" ? "Pagamento expirou." : "Pagamento falhou.");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!invoice || invoice.status === "confirmed" || invoice.status === "expired" || invoice.status === "failed") return;
    const interval = setInterval(async () => {
      const done = await pollInvoice(invoice.id);
      if (done) clearInterval(interval);
    }, 5000);
    return () => clearInterval(interval);
  }, [invoice, pollInvoice]);

  const methods: MethodOption[] = [];
  if (config?.nowpayments.enabled) {
    for (const c of config.nowpayments.currencies) {
      methods.push({ kind: "nowpayments", code: c.code, label: c.label, network: c.network });
    }
  }
  if (config?.mercadopago.enabled) {
    for (const m of config.mercadopago.methods) {
      methods.push({ kind: "mercadopago", code: m.code, label: m.label });
    }
  }

  const handleCreateInvoice = async () => {
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) return;
    const amt = parseFloat(amount);
    const min = config?.minDeposit ?? 10;
    if (amt < min) {
      toast.error(`Valor mínimo: ${fmtBRL(min)}`);
      return;
    }
    setCreating(true);
    try {
      const inv = await apiPost<Invoice>("/api/payments/create", {
        provider: selectedMethod.kind,
        payCurrency: selectedMethod.kind === "nowpayments" ? selectedMethod.code : "pix",
        amount: amt,
      });
      setInvoice(inv);
      toast.success("Pagamento gerado! Escaneie o QR ou acesse o link.");
    } catch (e: any) {
      toast.error(e?.message || e?.data?.error || "Erro ao criar pagamento");
    } finally {
      setCreating(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── Invoice / payment screen ──
  if (invoice) {
    const isPix = invoice.provider === "mercadopago";
    const isConfirmed = invoice.status === "confirmed";
    const statusLabel = {
      pending: "Aguardando pagamento",
      confirming: "Confirmando na blockchain",
      confirmed: "Pago e creditado",
      expired: "Expirado",
      failed: "Falhou",
    }[invoice.status];

    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setInvoice(null); setAmount(""); }}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold">{isConfirmed ? "Depósito Confirmado" : "Aguardando Pagamento"}</h2>
            <p className="text-xs text-muted-foreground">
              {isConfirmed ? "Saldo creditado na sua conta" : "Escaneie o QR Code ou copie os dados"}
            </p>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "16px", overflow: "hidden" }}>
          {/* Status */}
          <div style={{ background: isConfirmed ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.08)", borderBottom: `1px solid ${isConfirmed ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.15)"}`, padding: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            {isConfirmed ? <CheckCircle2 style={{ width: "20px", height: "20px", color: "#10b981" }} /> : <Clock style={{ width: "20px", height: "20px", color: "#f59e0b" }} />}
            <div className="flex-1">
              <p style={{ fontSize: "13px", fontWeight: 700, color: isConfirmed ? "#10b981" : "#f59e0b" }}>{statusLabel}</p>
              <p style={{ fontSize: "11px", color: "#64748b" }}>Fatura #{invoice.id} • {invoice.provider === "nowpayments" ? "NowPayments" : "PIX"}</p>
            </div>
            {!isConfirmed && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
          </div>

          <div className="p-4 space-y-4">
            {/* Amount */}
            <div style={{ textAlign: "center", padding: "16px", background: "rgba(245,158,11,0.06)", borderRadius: "12px" }}>
              <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>Valor a pagar</p>
              <p style={{ fontSize: "32px", fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.02em" }}>
                {fmtBRL(invoice.amountRequested)}
              </p>
              {invoice.payAmount && invoice.payCurrency && !isPix && (
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  ≈ {invoice.payAmount} {invoice.payCurrency.toUpperCase()}
                </p>
              )}
            </div>

            {/* QR Code */}
            {invoice.qrCodeUrl && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "10px", fontWeight: 600 }}>
                  {isPix ? "QR Code PIX" : "QR Code de pagamento"}
                </p>
                <img
                  src={invoice.qrCodeUrl}
                  alt="QR Code"
                  style={{ width: "200px", height: "200px", borderRadius: "12px", background: "#fff", padding: "8px", margin: "0 auto" }}
                />
              </div>
            )}

            {/* PIX copia e cola */}
            {isPix && invoice.pixPayload && (
              <div>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: 600 }}>PIX Copia e Cola</p>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <p style={{ flex: 1, fontSize: "11px", fontFamily: "monospace", color: "#e2e8f0", wordBreak: "break-all", lineHeight: 1.5 }}>
                    {invoice.pixPayload}
                  </p>
                  <button onClick={() => copyText(invoice.pixPayload!, "Código PIX")} style={{ flexShrink: 0, padding: "8px", borderRadius: "8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", cursor: "pointer" }}>
                    {copied === "Código PIX" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Crypto address */}
            {!isPix && invoice.payAddress && (
              <div>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: 600 }}>
                  Endereço {invoice.payCurrency?.toUpperCase()} ({invoice.provider === "nowpayments" ? "NowPayments" : ""})
                </p>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <p style={{ flex: 1, fontSize: "12px", fontFamily: "monospace", color: "#e2e8f0", wordBreak: "break-all", lineHeight: 1.5 }}>
                    {invoice.payAddress}
                  </p>
                  <button onClick={() => copyText(invoice.payAddress!, "Endereço")} style={{ flexShrink: 0, padding: "8px", borderRadius: "8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", cursor: "pointer" }}>
                    {copied === "Endereço" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Pay URL (nowpayments hosted page) */}
            {!isPix && invoice.payUrl && (
              <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir página de pagamento
                </Button>
              </a>
            )}

            <p style={{ fontSize: "11px", color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
              {isConfirmed
                ? "Seu saldo foi creditado automaticamente. Você já pode investir."
                : isPix
                ? "Após pagar o PIX, a confirmação é automática em poucos segundos."
                : "Após enviar o pagamento, a confirmação ocorre automaticamente conforme a rede blockchain."}
            </p>

            {isConfirmed && (
              <Button className="w-full" onClick={() => { setInvoice(null); setAmount(""); }}>
                Fazer outro depósito
              </Button>
            )}
            {!isConfirmed && (
              <Button variant="outline" className="w-full" onClick={() => { setInvoice(null); }}>
                Cancelar e voltar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ──
  const hasGateways = methods.length > 0;

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Depositar</h2>
        <p className="text-sm text-muted-foreground">
          {hasGateways
            ? "Escolha o método e o valor. Confirmação automática após o pagamento."
            : "Nenhum gateway de pagamento ativo. Contate o administrador."}
        </p>
      </div>

      {!hasGateways && (
        <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "32px 24px", textAlign: "center" }}>
          <Wallet style={{ width: "40px", height: "40px", color: "#64748b", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6 }}>
            Os gateways de pagamento (NowPayments / Mercado Pago PIX) ainda não foram configurados pelo administrador.
          </p>
        </div>
      )}

      {/* Method grid */}
      {hasGateways && (
        <div>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Método de Pagamento
          </p>
          <div className="grid grid-cols-2 gap-3">
            {methods.map((m, idx) => {
              const active = selectedMethod?.kind === m.kind && selectedMethod?.code === m.code;
              const isPix = m.kind === "mercadopago";
              const color = isPix ? "#10b981" : "#f59e0b";
              const short = isPix ? "PIX" : m.code.toUpperCase().slice(0, 4);
              return (
                <button
                  key={`${m.kind}-${m.code}-${idx}`}
                  onClick={() => setSelectedMethod(m)}
                  style={{
                    background: active ? `${color}12` : "#111827",
                    border: `1px solid ${active ? `${color}50` : "rgba(255,255,255,0.07)"}`,
                    borderRadius: "14px",
                    padding: "16px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px", fontSize: "11px", fontWeight: 800, color }}>
                    {short}
                  </div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "2px" }}>
                    {m.label}
                  </p>
                  <p style={{ fontSize: "10px", color: "#64748b" }}>
                    {isPix ? "Confirmação instantânea" : (m as any).network || "Via NowPayments"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Amount input */}
      {selectedMethod && (
        <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "20px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Valor do Depósito
          </p>
          <div className="relative mb-1">
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", fontWeight: 700, color: "#64748b" }}>
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min={config?.minDeposit ?? 10}
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ paddingLeft: "42px", fontSize: "18px", fontWeight: 700, height: "52px" }}
            />
          </div>
          <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "16px" }}>
            Valor mínimo: {fmtBRL(config?.minDeposit ?? 10)}
          </p>
          <Button
            className="w-full h-12 text-base font-bold"
            onClick={handleCreateInvoice}
            disabled={!amount || parseFloat(amount) < (config?.minDeposit ?? 10) || creating}
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            {creating ? "Gerando pagamento..." : "Gerar Pagamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
