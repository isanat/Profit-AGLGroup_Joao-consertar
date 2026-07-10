import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface Invoice {
  id: number; userId: number; userName: string; userEmail: string;
  provider: string; providerInvoiceId: string | null; providerStatus: string | null;
  status: string; amountRequested: number; priceCurrency: string;
  payCurrency: string | null; payAmount: number | null; amountPaid: number | null;
  referenceType: string; referenceId: number | null;
  createdAt: string; confirmedAt: string | null; expiresAt: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirming: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  confirming: "Confirmando",
  confirmed: "Confirmado",
  expired: "Expirado",
  failed: "Falhou",
};

export default function AdminPaymentInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");

  const load = () => {
    setLoading(true);
    apiGet<Invoice[]>(`/api/admin/payment-invoices${filter ? `?status=${filter}` : ""}${providerFilter ? `${filter ? "&" : "?"}provider=${providerFilter}` : ""}`)
      .then(setInvoices)
      .catch(() => toast.error("Erro ao carregar faturas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, providerFilter]);

  const totalConfirmed = invoices.filter(i => i.status === "confirmed").reduce((a, i) => a + i.amountRequested, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((a, i) => a + i.amountRequested, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Faturas de Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Pagamentos processados via NowPayments e Mercado Pago.</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-accent"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div style={{ background: "#111827", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "16px" }}>
          <p className="text-xs text-muted-foreground mb-1">Total confirmado</p>
          <p className="text-xl font-bold text-emerald-400">{fmtBRL(totalConfirmed)}</p>
        </div>
        <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "16px" }}>
          <p className="text-xs text-muted-foreground mb-1">Aguardando pagamento</p>
          <p className="text-xl font-bold text-amber-400">{fmtBRL(totalPending)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md bg-background border border-input px-3 text-sm">
          <option value="">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="confirming">Confirmando</option>
          <option value="confirmed">Confirmado</option>
          <option value="expired">Expirado</option>
          <option value="failed">Falhou</option>
        </select>
        <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="h-9 rounded-md bg-background border border-input px-3 text-sm">
          <option value="">Todos os provedores</option>
          <option value="nowpayments">NowPayments</option>
          <option value="mercadopago">Mercado Pago</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma fatura encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 16px" }}>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold">#{inv.id}</p>
                    <Badge className={STATUS_STYLE[inv.status] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}>{STATUS_LABEL[inv.status] || inv.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{inv.provider === "nowpayments" ? "NowPayments" : "Mercado Pago"}</Badge>
                    {inv.payCurrency && <Badge variant="outline" className="text-[10px]">{inv.payCurrency.toUpperCase()}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inv.userName} ({inv.userEmail}) • {fmtDate(inv.createdAt)}
                    {inv.confirmedAt && <span className="text-emerald-400"> • confirmado em {fmtDate(inv.confirmedAt)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-amber-400">{fmtBRL(inv.amountRequested)}</p>
                  <p className="text-xs text-muted-foreground">{inv.priceCurrency}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
