import { useListTransactions, ListTransactionsType } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TX_LABELS: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Saque",
  position_buy: "Plano ativado",
  yield: "Rendimento",
  yield_credit: "Rendimento",
  commission: "Bônus indicação",
};

const TX_COLORS: Record<string, string> = {
  deposit: "#10b981",
  yield: "#10b981",
  yield_credit: "#10b981",
  commission: "#f59e0b",
  withdrawal: "#ef4444",
  position_buy: "#6366f1",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "deposit", label: "Depósitos" },
  { value: "withdrawal", label: "Saques" },
  { value: "position_buy", label: "Planos" },
  { value: "yield_credit", label: "Rendimentos" },
  { value: "commission", label: "Bônus" },
];

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<ListTransactionsType | "all">("all");
  const [page, setPage] = useState(1);

  const { data: pageData, isLoading } = useListTransactions({
    type: typeFilter === "all" ? undefined : typeFilter,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Extrato</h2>
          <p className="text-sm text-muted-foreground">Histórico completo de movimentações.</p>
        </div>
        <Select value={typeFilter} onValueChange={(val: any) => { setTypeFilter(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : pageData?.data.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <History style={{ width: "36px", height: "36px", color: "#374151", margin: "0 auto 10px" }} />
            <p style={{ color: "#64748b", fontSize: "14px" }}>Nenhuma transação encontrada.</p>
          </div>
        ) : (
          <div>
            {pageData?.data.map((tx, i) => {
              const color = TX_COLORS[tx.type] ?? "#64748b";
              const positive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderBottom: i < (pageData.data.length - 1)
                      ? "1px solid rgba(255,255,255,0.04)"
                      : undefined,
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: `${color}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {positive
                      ? <ArrowDownLeft style={{ width: "18px", height: "18px", color }} />
                      : <ArrowUpRight style={{ width: "18px", height: "18px", color }} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-0.5">
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
                        {TX_LABELS[tx.type] ?? tx.type}
                      </p>
                    </div>
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
                    <p style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Amount */}
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: positive ? "#10b981" : "#ef4444",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {positive ? "+" : ""}
                    {fmtBRL(Math.abs(tx.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pageData && pageData.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </Button>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {page} / {pageData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pageData.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
