import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetStrategy,
  useFetchStrategyPerformance,
  useBuyPosition,
  getGetStrategyQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TrendingUp,
  Clock,
  ChevronLeft,
  BadgeCheck,
  Wallet,
  BarChart2,
  CalendarDays,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const strategyId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: strategy, isLoading } = useGetStrategy(strategyId, {
    query: {
      enabled: !!strategyId,
      queryKey: getGetStrategyQueryKey(strategyId),
    },
  });

  const { data: performance } = useFetchStrategyPerformance(strategyId, {
    query: { enabled: !!strategyId } as any,
  });

  const buyMutation = useBuyPosition();
  const [amount, setAmount] = useState<string>("");

  if (isLoading || !strategy) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const investmentValue = parseFloat(amount) || 0;
  const dailyRate = strategy.dailyProfitPercent > 0
    ? strategy.dailyProfitPercent
    : strategy.monthlyReturnPct > 0
      ? strategy.monthlyReturnPct / 30
      : 0;
  const durationDays = strategy.durationDays > 0 ? strategy.durationDays : 90;
  const maxReturnPct = strategy.maxReturnPct > 0 ? strategy.maxReturnPct : dailyRate * durationDays;

  const planValue = strategy.minInvestment;
  const previewAmount = investmentValue >= planValue ? investmentValue : planValue;
  const lucro = previewAmount * (maxReturnPct / 100);
  const retornoTotal = previewAmount + lucro;

  const handleBuy = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < planValue) {
      toast.error(`Valor mínimo: ${fmtBRL(planValue)}`);
      return;
    }
    buyMutation.mutate(
      { data: { strategyId, amount: parsed } },
      {
        onSuccess: () => {
          toast.success("Plano ativado com sucesso!");
          setAmount("");
          queryClient.invalidateQueries({ queryKey: getGetStrategyQueryKey(strategyId) });
          setLocation("/my-positions");
        },
        onError: (err: any) => {
          toast.error(err?.data?.error || "Erro ao ativar o plano. Tente novamente.");
        },
      }
    );
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => setLocation("/strategies")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          color: "#94a3b8",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0",
        }}
      >
        <ChevronLeft style={{ width: "16px", height: "16px" }} />
        Voltar aos Planos
      </button>

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 60%)",
          border: "1px solid rgba(245,158,11,0.20)",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "4px" }}>
              {strategy.category || "Plano"}
            </p>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.01em", marginBottom: "6px" }}>
              {strategy.name}
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
              {strategy.description}
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: "11px",
              fontWeight: 700,
              color: "#10b981",
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "20px",
              padding: "3px 12px",
            }}
          >
            Ativo
          </span>
        </div>

        {/* Quick metrics row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
              <TrendingUp style={{ width: "16px", height: "16px", color: "#10b981" }} />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", lineHeight: 1, marginBottom: "4px" }}>
              +{dailyRate.toFixed(2)}%
            </p>
            <p style={{ fontSize: "10px", color: "#64748b" }}>Rentab. Diária</p>
          </div>
          <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
              <BarChart2 style={{ width: "16px", height: "16px", color: "#f59e0b" }} />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#f59e0b", lineHeight: 1, marginBottom: "4px" }}>
              +{maxReturnPct.toFixed(0)}%
            </p>
            <p style={{ fontSize: "10px", color: "#64748b" }}>Retorno Total</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
              <CalendarDays style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#60a5fa", lineHeight: 1, marginBottom: "4px" }}>
              {durationDays}
            </p>
            <p style={{ fontSize: "10px", color: "#64748b" }}>Dias de Prazo</p>
          </div>
        </div>
      </div>

      {/* Layout: chart (left) + investment panel (right) */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Performance chart */}
        <div
          className="md:col-span-3"
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "16px" }}>
            Histórico de Performance
          </p>
          {performance && performance.length > 0 ? (
            <div style={{ height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickFormatter={(v) => `R$${v.toFixed(0)}`}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#f1f5f9" }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString("pt-BR")}
                    formatter={(val: number) => [fmtBRL(val), "Valor"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#perfGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              style={{
                height: "220px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <BarChart2 style={{ width: "32px", height: "32px", color: "#374151" }} />
              <p style={{ fontSize: "13px", color: "#64748b" }}>Histórico ainda não disponível</p>
            </div>
          )}
        </div>

        {/* Investment panel */}
        <div className="md:col-span-2 space-y-3">
          {/* Plan info card */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "18px",
            }}
          >
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "14px" }}>
              Detalhes do Plano
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Nome do Plano</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{strategy.name}</span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Valor do Plano</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>{fmtBRL(planValue)}</span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Prazo do Plano</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>
                  {durationDays} dias
                </span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Rentab. Diária</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>+{dailyRate.toFixed(2)}% / dia</span>
              </div>
            </div>
          </div>

          {/* Return preview card — dynamic */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(245,158,11,0.06) 100%)",
              border: "1px solid rgba(16,185,129,0.20)",
              borderRadius: "16px",
              padding: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
              <BadgeCheck style={{ width: "15px", height: "15px", color: "#10b981" }} />
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>
                Simulação de Retorno
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Investimento</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{fmtBRL(previewAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Lucro Previsto</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>+{fmtBRL(lucro)}</span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#f59e0b" }}>Retorno Total</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#f59e0b" }}>{fmtBRL(retornoTotal)}</span>
              </div>
            </div>

            <p style={{ fontSize: "10px", color: "#64748b", marginTop: "10px", lineHeight: 1.5 }}>
              * Projeção ao final de {durationDays} dias com rentabilidade de {maxReturnPct.toFixed(0)}% sobre o capital.
            </p>
          </div>

          {/* Investment form */}
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
              <Wallet style={{ width: "15px", height: "15px", color: "#f59e0b" }} />
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>Ativar Plano</p>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                Valor do Investimento (R$)
              </label>
              <input
                type="number"
                min={planValue}
                step="0.01"
                placeholder={`Mín. ${fmtBRL(planValue)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "10px",
                  color: "#f1f5f9",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                Valor mínimo: {fmtBRL(planValue)}
              </p>
            </div>

            <button
              onClick={handleBuy}
              disabled={buyMutation.isPending || !amount || parseFloat(amount) < planValue}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: "10px",
                border: "none",
                background:
                  buyMutation.isPending || !amount || parseFloat(amount) < planValue
                    ? "rgba(245,158,11,0.30)"
                    : "linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)",
                color: buyMutation.isPending || !amount || parseFloat(amount) < planValue ? "#64748b" : "#fff",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: buyMutation.isPending || !amount || parseFloat(amount) < planValue ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow:
                  !buyMutation.isPending && amount && parseFloat(amount) >= planValue
                    ? "0 4px 20px rgba(245,158,11,0.30)"
                    : "none",
              }}
            >
              {buyMutation.isPending ? "Processando..." : "ATIVAR PLANO"}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "10px",
                justifyContent: "center",
              }}
            >
              <Clock style={{ width: "11px", height: "11px", color: "#64748b" }} />
              <p style={{ fontSize: "10px", color: "#64748b" }}>
                Plano ativado imediatamente após confirmação
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
