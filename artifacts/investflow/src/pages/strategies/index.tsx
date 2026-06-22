import { useState } from "react";
import { useListStrategies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Strategies() {
  const { data: strategies, isLoading } = useListStrategies();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Planos de Investimento</h2>
          <p className="text-muted-foreground">Escolha o plano ideal para o seu perfil.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[340px] w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const active = strategies?.filter(s => s.status === "active") ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Planos de Investimento</h2>
        <p className="text-muted-foreground">Escolha o plano ideal e comece a rentabilizar hoje mesmo.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {active.map((plan) => {
          const isHovered = hoveredId === plan.id;
          return (
            <div
              key={plan.id}
              onMouseEnter={() => setHoveredId(plan.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: "linear-gradient(145deg, #111827 0%, #0f172a 100%)",
                border: isHovered ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(245,158,11,0.2)",
                boxShadow: isHovered
                  ? "0 0 32px rgba(245,158,11,0.12), 0 8px 32px rgba(0,0,0,0.4)"
                  : "0 4px 24px rgba(0,0,0,0.3)",
                transition: "all 0.25s ease",
                borderRadius: "16px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "24px 24px 20px",
                  borderBottom: "1px solid rgba(245,158,11,0.15)",
                  background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "#f59e0b",
                      textTransform: "uppercase",
                    }}
                  >
                    {plan.category || "Plano"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#10b981",
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      borderRadius: "20px",
                      padding: "2px 10px",
                    }}
                  >
                    Ativo
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#f1f5f9",
                    letterSpacing: "-0.01em",
                    marginBottom: "4px",
                  }}
                >
                  {plan.name}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {plan.description}
                </p>
              </div>

              {/* Plan value */}
              <div style={{ padding: "20px 24px 0" }}>
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: 500 }}>
                  Valor do Plano
                </p>
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "#f59e0b",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {fmtBRL(plan.minInvestment)}
                </p>
              </div>

              {/* Stats grid with dividers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
                  margin: "20px 24px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                {/* Daily profit */}
                <div style={{ padding: "16px 12px", textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#10b981",
                      lineHeight: 1,
                      marginBottom: "6px",
                    }}
                  >
                    +{plan.dailyProfitPercent > 0
                      ? plan.dailyProfitPercent.toFixed(2)
                      : plan.monthlyReturnPct > 0
                        ? (plan.monthlyReturnPct / 30).toFixed(2)
                        : "0.00"}%
                  </p>
                  <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, lineHeight: 1.3 }}>
                    Rentab.<br />Diária
                  </p>
                </div>

                {/* Vertical divider */}
                <div style={{ background: "rgba(255,255,255,0.07)", width: "1px" }} />

                {/* Max return */}
                <div style={{ padding: "16px 12px", textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#f1f5f9",
                      lineHeight: 1,
                      marginBottom: "6px",
                    }}
                  >
                    {plan.maxReturnPct > 0 ? plan.maxReturnPct.toFixed(0) : "200"}%
                  </p>
                  <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, lineHeight: 1.3 }}>
                    Retorno<br />Máximo
                  </p>
                </div>

                {/* Vertical divider */}
                <div style={{ background: "rgba(255,255,255,0.07)", width: "1px" }} />

                {/* Duration */}
                <div style={{ padding: "16px 12px", textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#f1f5f9",
                      lineHeight: 1,
                      marginBottom: "6px",
                    }}
                  >
                    {plan.durationDays > 0 ? plan.durationDays : 90}
                  </p>
                  <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, lineHeight: 1.3 }}>
                    Dias<br />de Prazo
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div style={{ padding: "0 24px 24px", marginTop: "auto" }}>
                <Link href={`/strategies/${plan.id}`} className="block w-full">
                  <button
                    style={{
                      width: "100%",
                      padding: "13px 0",
                      borderRadius: "10px",
                      border: "none",
                      background: isHovered
                        ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
                        : "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: isHovered ? "0 4px 20px rgba(245,158,11,0.35)" : "none",
                    }}
                  >
                    INVESTIR AGORA
                  </button>
                </Link>
              </div>
            </div>
          );
        })}

        {active.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            Nenhum plano disponível no momento.
          </div>
        )}
      </div>

      {/* Paused/closed strategies */}
      {(strategies?.filter(s => s.status !== "active") ?? []).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">Planos Encerrados</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {strategies?.filter(s => s.status !== "active").map(plan => (
              <div
                key={plan.id}
                style={{
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "16px",
                  padding: "20px 24px",
                  opacity: 0.6,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>{plan.category}</p>
                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#94a3b8" }}>{plan.name}</p>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#64748b",
                      background: "rgba(100,116,139,0.1)",
                      border: "1px solid rgba(100,116,139,0.25)",
                      borderRadius: "20px",
                      padding: "2px 10px",
                    }}
                  >
                    {plan.status === "paused" ? "Pausado" : "Encerrado"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
