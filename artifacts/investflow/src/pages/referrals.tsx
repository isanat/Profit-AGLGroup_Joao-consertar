import { useGetReferralInfo, useListCommissions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Copy, Award, TrendingUp, History, CheckCircle } from "lucide-react";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Referrals() {
  const { data: info, isLoading } = useGetReferralInfo();
  const { data: commissions, isLoading: commissionsLoading } = useListCommissions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!info) {
    return <p className="text-muted-foreground p-4">Erro ao carregar dados de indicações.</p>;
  }

  const copyLink = () => {
    navigator.clipboard.writeText(info.referralLink);
    toast.success("Link copiado!");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(info.referralCode);
    toast.success("Código copiado!");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Programa de Indicações</h2>
        <p className="text-sm text-muted-foreground">
          Indique amigos e receba {info.commissionRate}% de bônus sobre cada depósito aprovado.
        </p>
      </div>

      {/* Referral link card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0c1f14 0%, #111827 100%)",
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <p style={{ fontSize: "12px", fontWeight: 600, color: "#10b981", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Seu Link de Indicação
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              flex: 1,
              fontSize: "12px",
              color: "#94a3b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
          >
            {info.referralLink}
          </p>
          <button
            onClick={copyLink}
            style={{
              flexShrink: 0,
              padding: "7px",
              borderRadius: "8px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10b981",
              cursor: "pointer",
            }}
          >
            <Copy style={{ width: "15px", height: "15px" }} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: "11px", color: "#64748b" }}>Código de indicação</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", letterSpacing: "0.1em" }}>
              {info.referralCode}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <Copy className="h-3.5 w-3.5" />
            Copiar código
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Indicados", value: String(info.totalReferrals), sub: `${info.activeReferrals} ativos`, icon: Users, color: "#60a5fa" },
          { label: "Bônus Recebido", value: fmtBRL(info.totalCommissionEarned), sub: "Comissões pagas", icon: Award, color: "#f59e0b" },
          { label: "Taxa", value: `${info.commissionRate}%`, sub: "Por depósito", icon: TrendingUp, color: "#10b981" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "14px",
              padding: "14px 10px",
              textAlign: "center",
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
                margin: "0 auto 8px",
              }}
            >
              <s.icon style={{ width: "13px", height: "13px", color: s.color }} />
            </div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: s.color,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.value}
            </p>
            <p style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral network */}
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Users style={{ width: "16px", height: "16px", color: "#64748b" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>Sua Rede</p>
          </div>
          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            Bônus = {info.commissionRate}% de cada depósito aprovado
          </p>
        </div>

        {info.referrals.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Users style={{ width: "32px", height: "32px", color: "#374151", margin: "0 auto 10px" }} />
            <p style={{ fontSize: "13px", color: "#64748b" }}>Nenhum indicado ainda.</p>
            <p style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>Compartilhe seu link para começar!</p>
          </div>
        ) : (
          (info.referrals as any[]).map((ref, i) => (
            <div
              key={ref.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderBottom: i < info.referrals.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined,
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(ref.name ?? "?")[0].toUpperCase()}
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
                  {ref.name}
                </p>
                <p style={{ fontSize: "10px", color: "#64748b" }}>
                  {new Date(ref.joinedAt).toLocaleDateString("pt-BR")} · {fmtBRL(ref.totalInvested)} investido
                </p>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: ref.commissionGenerated > 0 ? "#f59e0b" : "#374151",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {ref.commissionGenerated > 0 ? `+${fmtBRL(ref.commissionGenerated)}` : "—"}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Commission history */}
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <History style={{ width: "16px", height: "16px", color: "#64748b" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>Histórico de Bônus</p>
          </div>
        </div>

        {commissionsLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : !commissions || (commissions as any[]).length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#64748b" }}>Nenhum bônus recebido ainda.</p>
          </div>
        ) : (
          (commissions as any[]).map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderBottom: i < (commissions as any[]).length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined,
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(245,158,11,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CheckCircle style={{ width: "16px", height: "16px", color: "#f59e0b" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#e2e8f0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.fromUserName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p style={{ fontSize: "10px", color: "#64748b" }}>
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <span style={{ fontSize: "10px", color: "#10b981" }}>{c.rate}%</span>
                  {c.depositId && (
                    <span style={{ fontSize: "10px", color: "#475569" }}>dep. #{c.depositId}</span>
                  )}
                  <Badge
                    variant="outline"
                    style={{
                      fontSize: "9px",
                      padding: "0 5px",
                      borderColor: c.status === "paid" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                      color: c.status === "paid" ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {c.status === "paid" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "#f59e0b", whiteSpace: "nowrap", flexShrink: 0 }}>
                +{fmtBRL(c.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
