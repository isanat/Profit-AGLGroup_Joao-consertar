import { useGetDepositMethods, useCreateDeposit, DepositInputMethod } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, Wallet, ArrowLeft } from "lucide-react";

const METHOD_ICONS: Record<string, string> = {
  pix: "PIX",
  usdt_bep20: "USDT",
  bitcoin: "BTC",
  usdc: "USDC",
  bnb: "BNB",
};

const METHOD_COLORS: Record<string, string> = {
  pix: "#10b981",
  usdt_bep20: "#26a17b",
  bitcoin: "#f59e0b",
  usdc: "#2775ca",
  bnb: "#f3ba2f",
};

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Deposit() {
  const { data: methods, isLoading } = useGetDepositMethods();
  const createDepositMutation = useCreateDeposit();

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [depositResult, setDepositResult] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const activeMethods = methods?.filter(m => m.isActive) || [];
  const selectedMethodDetails = activeMethods.find(m => m.method === selectedMethod);

  const handleDeposit = () => {
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) return;
    createDepositMutation.mutate(
      { data: { method: selectedMethod as DepositInputMethod, amount: parseFloat(amount) } },
      {
        onSuccess: (res) => {
          setDepositResult(res);
          toast.success("Depósito iniciado! Siga as instruções abaixo.");
        },
        onError: (err: any) => {
          toast.error(err?.data?.error || "Erro ao iniciar depósito");
        },
      },
    );
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // ── Success screen ──
  if (depositResult) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setDepositResult(null)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold">Instruções de Depósito</h2>
            <p className="text-xs text-muted-foreground">Aguardando confirmação do administrador</p>
          </div>
        </div>

        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          {/* Status banner */}
          <div
            style={{
              background: "rgba(16,185,129,0.08)",
              borderBottom: "1px solid rgba(16,185,129,0.15)",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <CheckCircle2 style={{ width: "20px", height: "20px", color: "#10b981", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>Depósito registrado</p>
              <p style={{ fontSize: "11px", color: "#64748b" }}>
                Status:{" "}
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 ml-1">
                  {depositResult.status === "pending" ? "Aguardando" : depositResult.status}
                </Badge>
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Amount */}
            <div style={{ textAlign: "center", padding: "16px", background: "rgba(245,158,11,0.06)", borderRadius: "12px" }}>
              <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>Valor a enviar</p>
              <p style={{ fontSize: "32px", fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.02em" }}>
                {fmtBRL(depositResult.amount)}
              </p>
            </div>

            {/* Wallet address */}
            {depositResult.walletAddress && (
              <div>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: 600 }}>
                  Endereço de destino
                </p>
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <p
                    style={{
                      flex: 1,
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "#e2e8f0",
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                    }}
                  >
                    {depositResult.walletAddress}
                  </p>
                  <button
                    onClick={() => copyText(depositResult.walletAddress, "Endereço")}
                    style={{
                      flexShrink: 0,
                      padding: "8px",
                      borderRadius: "8px",
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      color: "#f59e0b",
                      cursor: "pointer",
                    }}
                  >
                    <Copy style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>
              </div>
            )}

            {/* QR Code */}
            {depositResult.qrCodeUrl && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "10px", fontWeight: 600 }}>QR Code</p>
                <img
                  src={depositResult.qrCodeUrl}
                  alt="QR Code"
                  style={{ width: "180px", height: "180px", borderRadius: "12px", background: "#fff", padding: "8px", margin: "0 auto" }}
                />
              </div>
            )}

            <p style={{ fontSize: "11px", color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
              Apos o envio, o administrador confirmara o deposito e o saldo sera creditado em sua conta.
            </p>

            <Button variant="outline" className="w-full" onClick={() => setDepositResult(null)}>
              Fazer outro depósito
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Depositar</h2>
        <p className="text-sm text-muted-foreground">Escolha o método e o valor para depositar.</p>
      </div>

      {/* Method grid */}
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Método de Pagamento
        </p>
        <div className="grid grid-cols-2 gap-3">
          {activeMethods.map((method) => {
            const active = selectedMethod === method.method;
            const color = METHOD_COLORS[method.method] ?? "#64748b";
            return (
              <button
                key={method.method}
                onClick={() => setSelectedMethod(method.method)}
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
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: `${color}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "10px",
                    fontSize: "11px",
                    fontWeight: 800,
                    color,
                  }}
                >
                  {METHOD_ICONS[method.method] ?? method.method.toUpperCase().slice(0, 4)}
                </div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "2px" }}>
                  {method.label}
                </p>
                <p style={{ fontSize: "10px", color: "#64748b" }}>
                  Mín: {fmtBRL(method.minAmount)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount input */}
      {selectedMethod && (
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Valor do Depósito
          </p>

          <div className="relative mb-1">
            <span
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "14px",
                fontWeight: 700,
                color: "#64748b",
              }}
            >
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min={selectedMethodDetails?.minAmount}
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ paddingLeft: "42px", fontSize: "18px", fontWeight: 700, height: "52px" }}
            />
          </div>

          {selectedMethodDetails && (
            <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "16px" }}>
              Mínimo para {selectedMethodDetails.label}: {fmtBRL(selectedMethodDetails.minAmount)}
            </p>
          )}

          {selectedMethodDetails?.instructions && (
            <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "16px" }}>
              {selectedMethodDetails.instructions}
            </p>
          )}

          <Button
            className="w-full h-12 text-base font-bold"
            onClick={handleDeposit}
            disabled={
              !amount ||
              parseFloat(amount) < (selectedMethodDetails?.minAmount || 0) ||
              createDepositMutation.isPending
            }
          >
            <Wallet className="mr-2 h-4 w-4" />
            {createDepositMutation.isPending ? "Processando..." : "Continuar"}
          </Button>
        </div>
      )}

      {activeMethods.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#64748b" }}>
          <p>Nenhum método de pagamento disponível no momento.</p>
        </div>
      )}
    </div>
  );
}
