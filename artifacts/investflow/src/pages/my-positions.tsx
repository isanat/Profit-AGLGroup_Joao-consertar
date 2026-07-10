import { useGetPositionsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Briefcase, TrendingUp, DollarSign, BarChart2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MyPositions() {
  const { data: summary, isLoading } = useGetPositionsSummary();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Erro ao carregar posições.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Minhas Posições</h2>
        <p className="text-sm text-muted-foreground">Seus planos de investimento ativos.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Investido", value: fmtBRL(summary.totalInvested), icon: DollarSign, color: "#f59e0b" },
          { label: "Valor Atual", value: fmtBRL(summary.totalCurrentValue), icon: BarChart2, color: "#60a5fa" },
          {
            label: "Rendimento",
            value: `${summary.totalYield >= 0 ? "+" : ""}${fmtBRL(summary.totalYield)}`,
            icon: TrendingUp,
            color: summary.totalYield >= 0 ? "#10b981" : "#ef4444",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "14px",
              padding: "14px 12px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: `${s.color}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "8px",
              }}
            >
              <s.icon style={{ width: "14px", height: "14px", color: s.color }} />
            </div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: s.color,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.value}
            </p>
            <p style={{ fontSize: "9px", color: "#64748b", marginTop: "2px", lineHeight: 1.3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ROI note */}
      {summary.totalInvested > 0 && (
        <p style={{ fontSize: "12px", color: "#64748b", textAlign: "right" }}>
          ROI total:{" "}
          <span style={{ color: summary.totalYieldPercentage >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
            {summary.totalYieldPercentage >= 0 ? "+" : ""}
            {summary.totalYieldPercentage.toFixed(2)}%
          </span>
        </p>
      )}

      {/* Position cards */}
      <div className="space-y-3">
        {summary.byStrategy.length === 0 ? (
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <Briefcase style={{ width: "40px", height: "40px", color: "#374151", margin: "0 auto 12px" }} />
            <p style={{ color: "#64748b", fontSize: "14px" }}>Nenhuma posição ativa.</p>
            <Link href="/strategies">
              <span
                style={{
                  display: "inline-block",
                  marginTop: "12px",
                  fontSize: "13px",
                  color: "#f59e0b",
                  fontWeight: 600,
                }}
              >
                Ver planos disponíveis
              </span>
            </Link>
          </div>
        ) : (
          summary.byStrategy.map((pos) => (
            <div
              key={pos.id}
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#f1f5f9",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pos.strategyName}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                    {pos.shares} cotas
                  </p>
                </div>
                <Badge
                  variant="outline"
                  style={{
                    flexShrink: 0,
                    fontSize: "10px",
                    borderColor: pos.status === "active" ? "rgba(16,185,129,0.4)" : "rgba(100,116,139,0.4)",
                    color: pos.status === "active" ? "#10b981" : "#64748b",
                    background: pos.status === "active" ? "rgba(16,185,129,0.08)" : "transparent",
                  }}
                >
                  {pos.status === "active" ? "Ativo" : pos.status}
                </Badge>
              </div>

              {/* Values grid */}
              <div className="grid grid-cols-3 gap-2">
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ fontSize: "9px", color: "#64748b", marginBottom: "4px" }}>Investido</p>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b" }}>
                    {fmtBRL(pos.investedAmount)}
                  </p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ fontSize: "9px", color: "#64748b", marginBottom: "4px" }}>Valor Atual</p>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#60a5fa" }}>
                    {fmtBRL(pos.currentValue)}
                  </p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ fontSize: "9px", color: "#64748b", marginBottom: "4px" }}>Rendimento</p>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: pos.yieldAmount >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {pos.yieldAmount >= 0 ? "+" : ""}
                    {fmtBRL(pos.yieldAmount)}
                  </p>
                </div>
              </div>

              {pos.yieldPercentage !== 0 && (
                <p style={{ fontSize: "10px", color: "#64748b", marginTop: "8px", textAlign: "right" }}>
                  ROI:{" "}
                  <span style={{ color: pos.yieldPercentage >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {pos.yieldPercentage >= 0 ? "+" : ""}{pos.yieldPercentage.toFixed(2)}%
                  </span>
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
