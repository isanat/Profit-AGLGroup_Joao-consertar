import { useAuth } from "@/lib/auth";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Briefcase, Users, Gift,
  ArrowDownLeft, ArrowUpRight, Clock, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Saque",
  position_buy: "Plano ativado",
  yield: "Rendimento",
  commission: "Bônus indicação",
};

const TX_TYPE_COLOR: Record<string, string> = {
  deposit: "#10b981",
  yield: "#10b981",
  commission: "#f59e0b",
  withdrawal: "#ef4444",
  position_buy: "#6366f1",
};

interface StatCard {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity();

  const initial = (user?.name ?? "U")[0].toUpperCase();

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const stats: StatCard[] = [
    {
      label: "Total Investido",
      value: fmtBRL(summary.totalInvested ?? 0),
      icon: Briefcase,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
    {
      label: "Ganhos Totais",
      value: fmtBRL(summary.totalYield ?? 0),
      subValue: `+${(summary.yieldPercentage ?? 0).toFixed(2)}%`,
      icon: TrendingUp,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Total Depositado",
      value: fmtBRL((summary as any).totalDeposited ?? 0),
      icon: ArrowDownLeft,
      color: "#60a5fa",
      bg: "rgba(96,165,250,0.1)",
    },
    {
      label: "Total Sacado",
      value: fmtBRL((summary as any).totalWithdrawn ?? 0),
      icon: ArrowUpRight,
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.1)",
    },
    {
      label: "Indicações",
      value: String(summary.referralCount ?? 0),
      icon: Users,
      color: "#34d399",
      bg: "rgba(52,211,153,0.1)",
    },
    {
      label: "Bônus Recebidos",
      value: fmtBRL(summary.commissionEarned ?? 0),
      icon: Gift,
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.1)",
    },
  ];

  return (
    <div className="space-y-4 pb-2">
      {/* ── Hero card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f1e35 0%, #111827 50%, #0c1a2e 100%)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: "20px",
          padding: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "160px",
            height: "160px",
            background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="flex items-center gap-4 mb-5">
          {/* Avatar */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #b45309, #f59e0b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 0 0 3px rgba(245,158,11,0.2)",
            }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "2px" }}>Bem-vindo de volta</p>
            <p
              style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "#f1f5f9",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.name}
            </p>
            <span
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#f59e0b",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "20px",
                padding: "1px 8px",
                marginTop: "2px",
              }}
            >
              VIP
            </span>
          </div>
        </div>

        {/* Balance */}
        <div style={{ marginBottom: "4px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, marginBottom: "4px" }}>
            Saldo Disponível
          </p>
          <p
            style={{
              fontSize: "36px",
              fontWeight: 900,
              color: "#f59e0b",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {fmtBRL(summary.balance ?? 0)}
          </p>
        </div>

        {/* Quick stats row */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div>
            <p style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>Planos Ativos</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#10b981" }}>
              {summary.activePositions ?? 0}
            </p>
          </div>
          {(summary as any).pendingDeposits > 0 && (
            <div>
              <p style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>Dep. Pendente</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#fbbf24" }}>
                {fmtBRL((summary as any).pendingDeposits)}
              </p>
            </div>
          )}
          {(summary as any).referralCode && (
            <div className="ml-auto">
              <p style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>Código</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>
                {(summary as any).referralCode}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "/deposit", label: "Depositar", icon: ArrowDownLeft, color: "#10b981" },
          { href: "/withdraw", label: "Sacar", icon: ArrowUpRight, color: "#ef4444" },
          { href: "/strategies", label: "Investir", icon: TrendingUp, color: "#f59e0b" },
        ].map(action => (
          <Link key={action.href} href={action.href}>
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px",
                padding: "14px 8px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: `${action.color}18`,
                  border: `1px solid ${action.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                }}
              >
                <action.icon style={{ width: "18px", height: "18px", color: action.color }} />
              </div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>{action.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Stats grid 2 colunas ── */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "16px",
              minWidth: 0,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#64748b",
                  lineHeight: 1.3,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </p>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: s.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: "6px",
                }}
              >
                <s.icon style={{ width: "14px", height: "14px", color: s.color }} />
              </div>
            </div>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: s.color,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.value}
            </p>
            {s.subValue && (
              <p style={{ fontSize: "10px", color: "#10b981", marginTop: "2px", fontWeight: 600 }}>
                {s.subValue}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Atividade Recente ── */}
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>Atividade Recente</p>
          <Link href="/transactions">
            <span style={{ fontSize: "12px", color: "#10b981", display: "flex", alignItems: "center", gap: "2px" }}>
              Ver tudo <ChevronRight style={{ width: "14px", height: "14px" }} />
            </span>
          </Link>
        </div>
        {!activity?.length ? (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <Clock style={{ width: "32px", height: "32px", color: "#374151", margin: "0 auto 8px" }} />
            <p style={{ fontSize: "13px", color: "#64748b" }}>Nenhuma atividade ainda</p>
          </div>
        ) : (
          <div>
            {(activity as any[]).slice(0, 5).map((tx: any, i: number) => (
              <div
                key={tx.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderBottom: i < Math.min((activity as any[]).length, 5) - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : undefined,
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: `${TX_TYPE_COLOR[tx.type] ?? "#64748b"}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {tx.amount > 0
                    ? <ArrowDownLeft style={{ width: "16px", height: "16px", color: TX_TYPE_COLOR[tx.type] ?? "#64748b" }} />
                    : <ArrowUpRight style={{ width: "16px", height: "16px", color: TX_TYPE_COLOR[tx.type] ?? "#64748b" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {TX_TYPE_LABEL[tx.type] ?? tx.type}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tx.description}
                  </p>
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: tx.amount > 0 ? "#10b981" : "#ef4444",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {fmtBRL(Math.abs(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
