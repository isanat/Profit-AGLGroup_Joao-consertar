import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Handshake, Plus, Pencil, Trash2, DollarSign, History, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Partner {
  id: number; name: string; email: string | null; document: string | null;
  splitPercent: number; payoutMethod: string | null; pixKey: string | null; pixKeyType: string | null;
  cryptoWallet: string | null; bankInfo: string | null;
  balanceDue: number; totalEarned: number; totalPaid: number;
  notes: string | null; status: "active" | "inactive"; createdAt: string;
}

interface Split {
  id: number; baseAmount: number; splitPercent: number; amount: number;
  status: string; description: string | null; userId: number | null;
  paymentInvoiceId: number | null; paidAt: string | null; createdAt: string;
}

interface Payout {
  id: number; partnerId: number; partnerName: string; amount: number;
  method: string; destination: string | null; status: string; notes: string | null;
  processedAt: string | null; createdAt: string;
}

const BLANK = {
  name: "", email: "", document: "", splitPercent: "30",
  payoutMethod: "pix", pixKey: "", pixKeyType: "cpf", cryptoWallet: "", bankInfo: "",
  notes: "", status: "active",
};

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  const loadPartners = () => {
    apiGet<Partner[]>("/api/admin/partners")
      .then(setPartners)
      .catch(() => toast.error("Erro ao carregar sócios"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPartners(); }, []);

  const loadPartnerDetail = async (p: Partner) => {
    setSelectedPartner(p);
    setPayoutAmount("");
    setShowPayoutForm(false);
    try {
      const [s, po] = await Promise.all([
        apiGet<Split[]>(`/api/admin/partners/${p.id}/splits`),
        apiGet<Payout[]>("/api/admin/partner-payouts"),
      ]);
      setSplits(s);
      setPayouts(po.filter(x => x.partnerId === p.id));
    } catch { toast.error("Erro ao carregar detalhes"); }
  };

  const openCreate = () => { setEditing(null); setForm({ ...BLANK }); setShowForm(true); };
  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name, email: p.email || "", document: p.document || "",
      splitPercent: String(p.splitPercent), payoutMethod: p.payoutMethod || "pix",
      pixKey: p.pixKey || "", pixKeyType: p.pixKeyType || "cpf", cryptoWallet: p.cryptoWallet || "",
      bankInfo: p.bankInfo || "", notes: p.notes || "", status: p.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const pct = parseFloat(form.splitPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("Porcentagem deve ser 0-100"); return; }
    setSaving(true);
    try {
      const body = { ...form, splitPercent: pct };
      if (editing) {
        await apiPatch(`/api/admin/partners/${editing.id}`, body);
        toast.success("Sócio atualizado");
      } else {
        await apiPost("/api/admin/partners", body);
        toast.success("Sócio cadastrado");
      }
      setShowForm(false);
      loadPartners();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Partner) => {
    if (!confirm(`Remover o sócio "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiDelete(`/api/admin/partners/${p.id}`);
      toast.success("Sócio removido");
      loadPartners();
      if (selectedPartner?.id === p.id) setSelectedPartner(null);
    } catch (e: any) { toast.error(e?.message || "Erro ao remover"); }
  };

  const handlePayout = async () => {
    if (!selectedPartner || !payoutAmount) return;
    const amt = parseFloat(payoutAmount);
    if (amt <= 0 || amt > selectedPartner.balanceDue) {
      toast.error(`Valor inválido (disponível: ${fmtBRL(selectedPartner.balanceDue)})`);
      return;
    }
    try {
      await apiPost("/api/admin/partner-payouts", {
        partnerId: selectedPartner.id,
        amount: amt,
        method: selectedPartner.payoutMethod || "pix",
        destination: selectedPartner.payoutMethod === "pix" ? selectedPartner.pixKey : selectedPartner.cryptoWallet,
        notes: "Payout manual",
      });
      toast.success("Payout registrado");
      setPayoutAmount("");
      setShowPayoutForm(false);
      loadPartners();
      // refresh detail
      const [updated] = await apiGet<Partner[]>("/api/admin/partners");
      const p = updated.find(x => x.id === selectedPartner.id);
      if (p) await loadPartnerDetail(p);
    } catch (e: any) { toast.error(e?.message || "Erro ao registrar payout"); }
  };

  const totalSplitPct = partners.filter(p => p.status === "active").reduce((a, p) => a + p.splitPercent, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="h-6 w-6" /> Sócios & Split</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sócios recebem % de cada pagamento confirmado via gateway.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Sócio</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Sócios ativos" value={String(partners.filter(p => p.status === "active").length)} color="#10b981" />
        <StatCard label="% Total distribuído" value={`${totalSplitPct.toFixed(2)}%`} color={totalSplitPct > 100 ? "#ef4444" : "#f59e0b"} />
        <StatCard label="Saldo a pagar" value={fmtBRL(partners.reduce((a, p) => a + p.balanceDue, 0))} color="#f59e0b" />
      </div>
      {totalSplitPct > 100 && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
          ⚠ A soma das porcentagens dos sócios ativos ({totalSplitPct.toFixed(2)}%) excede 100%. Os valores serão normalizados proporcionalmente.
        </div>
      )}

      {/* Partners list */}
      <div className="space-y-2">
        {partners.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Handshake className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum sócio cadastrado.</p>
            <p className="text-xs">Clique em "Novo Sócio" para começar.</p>
          </div>
        )}
        {partners.map((p) => (
          <div key={p.id} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
            <div className="flex items-center gap-4">
              <div className="flex-1 cursor-pointer" onClick={() => loadPartnerDetail(p)}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-base">{p.name}</p>
                  <Badge className={p.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}>
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.email || "sem email"} • {p.payoutMethod || "sem método de payout"}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-400">{p.splitPercent}%</p>
                <p className="text-xs text-muted-foreground">de cada pagamento</p>
              </div>
              <div className="text-right min-w-[120px]">
                <p className="text-sm font-bold text-emerald-400">{fmtBRL(p.balanceDue)}</p>
                <p className="text-xs text-muted-foreground">a receber</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Partner detail drawer */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSelectedPartner(null)}>
          <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ background: "#0B1120", borderLeft: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedPartner.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedPartner.email}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPartner(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <MiniStat label="Split" value={`${selectedPartner.splitPercent}%`} />
              <MiniStat label="A receber" value={fmtBRL(selectedPartner.balanceDue)} />
              <MiniStat label="Total ganho" value={fmtBRL(selectedPartner.totalEarned)} />
            </div>

            {/* Payout form */}
            <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "16px" }} className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-bold">Registrar Payout</p>
              </div>
              {showPayoutForm ? (
                <div className="space-y-2">
                  <Input type="number" step="0.01" placeholder={`Valor (máx ${fmtBRL(selectedPartner.balanceDue)})`} value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handlePayout}>Confirmar Payout</Button>
                    <Button variant="outline" onClick={() => setShowPayoutForm(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button className="w-full" disabled={selectedPartner.balanceDue <= 0} onClick={() => setShowPayoutForm(true)}>
                  <DollarSign className="h-4 w-4 mr-2" /> Registrar Saque
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Via: {selectedPartner.payoutMethod || "—"} {selectedPartner.payoutMethod === "pix" ? `(${selectedPartner.pixKey})` : selectedPartner.cryptoWallet ? `(${selectedPartner.cryptoWallet.slice(0,12)}...)` : ""}
              </p>
            </div>

            {/* Splits history */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-bold">Splits recebidos</p></div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {splits.length === 0 && <p className="text-xs text-muted-foreground p-3">Nenhum split ainda.</p>}
                {splits.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <p className="font-medium">{fmtBRL(s.amount)}</p>
                      <p className="text-muted-foreground text-[10px]">{s.description}</p>
                    </div>
                    <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payouts history */}
            <div>
              <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-bold">Saques</p></div>
              <div className="space-y-1">
                {payouts.length === 0 && <p className="text-xs text-muted-foreground p-3">Nenhum saque registrado.</p>}
                {payouts.map((po) => (
                  <div key={po.id} className="flex items-center justify-between text-xs p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <p className="font-medium">{fmtBRL(po.amount)}</p>
                      <p className="text-muted-foreground text-[10px]">{po.method} • {new Date(po.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{po.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl" style={{ background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? "Editar Sócio" : "Novo Sócio"}</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              <Field label="Nome *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="CPF/CNPJ" value={form.document} onChange={(v) => setForm({ ...form, document: v })} />
              </div>
              <Field label="% de Split (0-100) *" type="number" value={form.splitPercent} onChange={(v) => setForm({ ...form, splitPercent: v })} />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Método de Payout</label>
                <select value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                  <option value="pix">PIX</option>
                  <option value="crypto">Cripto</option>
                  <option value="bank">Transferência Bancária</option>
                </select>
              </div>
              {form.payoutMethod === "pix" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo da chave</label>
                    <select value={form.pixKeyType} onChange={(e) => setForm({ ...form, pixKeyType: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Aleatória</option>
                    </select>
                  </div>
                  <Field label="Chave PIX" value={form.pixKey} onChange={(v) => setForm({ ...form, pixKey: v })} />
                </div>
              )}
              {form.payoutMethod === "crypto" && (
                <Field label="Endereço da carteira" value={form.cryptoWallet} onChange={(v) => setForm({ ...form, cryptoWallet: v })} />
              )}
              {form.payoutMethod === "bank" && (
                <Field label="Dados bancários (banco, agência, conta, tipo)" value={form.bankInfo} onChange={(v) => setForm({ ...form, bankInfo: v })} />
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                  <option value="active">Ativo (recebe splits)</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
              <Field label="Observações" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {saving ? "Salvando..." : (editing ? "Salvar Alterações" : "Cadastrar Sócio")}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
