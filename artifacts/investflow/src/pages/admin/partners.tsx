import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Handshake, Plus, Pencil, Trash2, DollarSign, History, X, Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

const fmtUSD = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

interface Partner {
  id: number; name: string; email: string | null; role: string | null; document: string | null;
  splitPercent: number;
  payoutWallet: string | null; payoutCurrency: string; minPayout: number; autoPayout: boolean;
  payoutMethod: string | null; pixKey: string | null; pixKeyType: string | null;
  cryptoWallet: string | null; bankInfo: string | null;
  balanceDue: number; pendingPayout: number; totalEarned: number; totalPaid: number;
  notes: string | null; status: "active" | "inactive"; createdAt: string;
}

interface Split {
  id: number; baseAmount: number; amountUsd: number; splitPercent: number;
  status: string; description: string | null; userId: number | null;
  paymentInvoiceId: number | null; payoutId: number | null; paidAt: string | null; createdAt: string;
}

interface Payout {
  id: number; partnerId: number; partnerName: string; amount: number; usdAmount: number;
  currency: string; method: string; destination: string | null;
  providerPayoutId: string | null; providerStatus: string | null;
  status: string; transactionHash: string | null; failureReason: string | null;
  notes: string | null; processedAt: string | null; createdAt: string;
}

const BLANK = {
  name: "", email: "", role: "dev", document: "", splitPercent: "7.5",
  payoutWallet: "", payoutCurrency: "usdtbsc", minPayout: "10", autoPayout: true,
  payoutMethod: "crypto", pixKey: "", pixKeyType: "cpf", cryptoWallet: "", bankInfo: "",
  notes: "", status: "active",
};

export default function AdminPartners() {
  return <PartnersContent embedded />;
}

export function PartnersContent({ embedded = false }: { embedded?: boolean }) {
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
  const [confirmPayout, setConfirmPayout] = useState<Payout | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

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
      name: p.name, email: p.email || "", role: p.role || "dev", document: p.document || "",
      splitPercent: String(p.splitPercent),
      payoutWallet: p.payoutWallet || "", payoutCurrency: p.payoutCurrency, minPayout: String(p.minPayout), autoPayout: p.autoPayout,
      payoutMethod: p.payoutMethod || "crypto", pixKey: p.pixKey || "", pixKeyType: p.pixKeyType || "cpf",
      cryptoWallet: p.cryptoWallet || "", bankInfo: p.bankInfo || "", notes: p.notes || "", status: p.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const pct = parseFloat(form.splitPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("Porcentagem deve ser 0-100"); return; }
    if (!form.payoutWallet.trim() && form.autoPayout) {
      toast.error("Carteira de payout é obrigatória para auto-payout"); return;
    }
    setSaving(true);
    try {
      const body = { ...form, splitPercent: pct, minPayout: parseFloat(form.minPayout) || 10 };
      if (editing) {
        await apiPatch(`/api/admin/partners/${editing.id}`, body);
        toast.success("Sócio atualizado");
      } else {
        await apiPost("/api/admin/partners", body);
        toast.success("Sócio cadastrado");
      }
      setShowForm(false);
      loadPartners();
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p: Partner) => {
    if (!confirm(`Remover o sócio "${p.name}"?`)) return;
    try { await apiDelete(`/api/admin/partners/${p.id}`); toast.success("Sócio removido"); loadPartners(); if (selectedPartner?.id === p.id) setSelectedPartner(null); }
    catch (e: any) { toast.error(e?.message || "Erro ao remover"); }
  };

  const handleTriggerPayout = async (p: Partner) => {
    if (!confirm(`Disparar auto-payout de ${fmtUSD(p.balanceDue)} via NowPayments para ${p.name}?`)) return;
    try {
      await apiPost(`/api/admin/partners/${p.id}/trigger-payout`, {});
      toast.success("Payout disparado via NowPayments");
      loadPartners();
      const [updated] = await apiGet<Partner[]>("/api/admin/partners");
      const fp = updated.find(x => x.id === p.id);
      if (fp) await loadPartnerDetail(fp);
    } catch (e: any) { toast.error(e?.message || "Erro ao disparar payout"); }
  };

  const handleConfirmPayout = async () => {
    if (!confirmPayout || !verifyCode.trim()) return;
    try {
      await apiPost(`/api/admin/partner-payouts/${confirmPayout.id}/confirm`, { verificationCode: verifyCode.trim() });
      toast.success("Payout confirmado");
      setConfirmPayout(null); setVerifyCode("");
      loadPartners();
      if (selectedPartner) await loadPartnerDetail(selectedPartner);
    } catch (e: any) { toast.error(e?.message || "Erro ao confirmar"); }
  };

  const handleManualPayout = async () => {
    if (!selectedPartner || !payoutAmount) return;
    const amt = parseFloat(payoutAmount);
    if (amt <= 0 || amt > selectedPartner.balanceDue) { toast.error(`Valor inválido (disponível: ${fmtUSD(selectedPartner.balanceDue)})`); return; }
    try {
      await apiPost("/api/admin/partner-payouts", { partnerId: selectedPartner.id, amount: amt, method: "manual", notes: "Payout manual" });
      toast.success("Payout manual registrado");
      setPayoutAmount(""); setShowPayoutForm(false);
      loadPartners();
      const [updated] = await apiGet<Partner[]>("/api/admin/partners");
      const p = updated.find(x => x.id === selectedPartner.id);
      if (p) await loadPartnerDetail(p);
    } catch (e: any) { toast.error(e?.message || "Erro ao registrar payout"); }
  };

  const totalSplitPct = partners.filter(p => p.status === "active").reduce((a, p) => a + p.splitPercent, 0);
  const awaitingPayouts = payouts.filter(p => p.status === "awaiting_confirmation");

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="h-6 w-6" /> Sócios & Split</h1>
            <p className="text-sm text-muted-foreground mt-1">Auto-payout em USDT via NowPayments quando o acumulado atinge o mínimo.</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Sócio</Button>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-end">
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Sócio</Button>
        </div>
      )}

      {awaitingPayouts.length > 0 && (
        <div className="p-4 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-amber-400" /><p className="font-bold text-amber-400">{awaitingPayouts.length} payout(s) aguardando confirmação 2FA</p></div>
          <p className="text-xs text-muted-foreground mb-3">Estes payouts foram criados no NowPayments e precisam do código de verificação enviado por email.</p>
          <div className="space-y-2">
            {awaitingPayouts.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-sm flex-1">#{p.id} • {p.partnerName} • {fmtUSD(p.usdAmount)}</span>
                <Button size="sm" onClick={() => setConfirmPayout(p)}><ShieldCheck className="h-3 w-3 mr-1" /> Confirmar com código</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Sócios ativos" value={String(partners.filter(p => p.status === "active").length)} color="#10b981" />
        <StatCard label="% Total" value={`${totalSplitPct.toFixed(2)}%`} color={totalSplitPct > 100 ? "#ef4444" : "#f59e0b"} />
        <StatCard label="A pagar (USD)" value={fmtUSD(partners.reduce((a, p) => a + p.balanceDue, 0))} color="#f59e0b" />
        <StatCard label="Enviado total" value={fmtUSD(partners.reduce((a, p) => a + p.totalPaid, 0))} color="#10b981" />
      </div>
      {totalSplitPct > 100 && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
          ⚠ A soma das porcentagens ({totalSplitPct.toFixed(2)}%) excede 100%. Os valores serão normalizados proporcionalmente.
        </div>
      )}

      <div className="space-y-2">
        {partners.length === 0 && (
          <div className="text-center py-12 text-muted-foreground"><Handshake className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>Nenhum sócio cadastrado.</p></div>
        )}
        {partners.map((p) => (
          <div key={p.id} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
            <div className="flex items-center gap-4">
              <div className="flex-1 cursor-pointer" onClick={() => loadPartnerDetail(p)}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-base">{p.name}</p>
                  {p.role && <Badge variant="outline" className="text-[10px]">{p.role}</Badge>}
                  <Badge className={p.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}>{p.status === "active" ? "Ativo" : "Inativo"}</Badge>
                  {p.autoPayout && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Auto-payout</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{p.payoutWallet ? `${p.payoutWallet.slice(0,10)}...${p.payoutWallet.slice(-6)} • ${p.payoutCurrency}` : "sem carteira"}</p>
              </div>
              <div className="text-right"><p className="text-2xl font-bold text-amber-400">{p.splitPercent}%</p><p className="text-xs text-muted-foreground">de cada depósito</p></div>
              <div className="text-right min-w-[110px]">
                <p className="text-sm font-bold text-emerald-400">{fmtUSD(p.balanceDue)}</p>
                <p className="text-[10px] text-muted-foreground">mín: {fmtUSD(p.minPayout)}</p>
              </div>
              <div className="flex gap-1">
                {p.balanceDue >= p.minPayout && p.autoPayout && <Button size="sm" onClick={() => handleTriggerPayout(p)} title="Disparar payout"><Send className="h-3 w-3" /></Button>}
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
              <div><h2 className="text-xl font-bold">{selectedPartner.name}</h2><p className="text-xs text-muted-foreground">{selectedPartner.email} • {selectedPartner.role}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPartner(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MiniStat label="Split" value={`${selectedPartner.splitPercent}%`} />
              <MiniStat label="A pagar" value={fmtUSD(selectedPartner.balanceDue)} />
              <MiniStat label="Pendente" value={fmtUSD(selectedPartner.pendingPayout)} />
              <MiniStat label="Enviado" value={fmtUSD(selectedPartner.totalPaid)} />
            </div>
            <div className="p-3 rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[10px] text-muted-foreground mb-1">Carteira de payout (NowPayments)</p>
              <p className="text-xs font-mono break-all">{selectedPartner.payoutWallet || "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Moeda: {selectedPartner.payoutCurrency} • Mín: {fmtUSD(selectedPartner.minPayout)} • Auto: {selectedPartner.autoPayout ? "Sim" : "Não"}</p>
            </div>

            <div style={{ background: "#111827", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "16px" }} className="mb-4">
              <div className="flex items-center gap-2 mb-3"><DollarSign className="h-4 w-4 text-emerald-400" /><p className="text-sm font-bold">Payout</p></div>
              {selectedPartner.balanceDue >= selectedPartner.minPayout ? (
                <Button className="w-full mb-2" onClick={() => handleTriggerPayout(selectedPartner)}><Send className="h-4 w-4 mr-2" /> Disparar via NowPayments ({fmtUSD(selectedPartner.balanceDue)})</Button>
              ) : (
                <p className="text-xs text-muted-foreground mb-2">Aguardando atingir mínimo ({fmtUSD(selectedPartner.minPayout)}). Acumulado: {fmtUSD(selectedPartner.balanceDue)}</p>
              )}
              {showPayoutForm ? (
                <div className="space-y-2">
                  <Input type="number" step="0.01" placeholder={`Valor manual (máx ${fmtUSD(selectedPartner.balanceDue)})`} value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                  <div className="flex gap-2"><Button className="flex-1" onClick={handleManualPayout}>Registrar Manual</Button><Button variant="outline" onClick={() => setShowPayoutForm(false)}>Cancelar</Button></div>
                </div>
              ) : (
                <Button variant="outline" className="w-full" disabled={selectedPartner.balanceDue <= 0} onClick={() => setShowPayoutForm(true)}>Registrar Payout Manual</Button>
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-bold">Splits ({splits.length})</p></div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {splits.length === 0 && <p className="text-xs text-muted-foreground p-3">Nenhum split ainda.</p>}
                {splits.slice(0, 30).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div><p className="font-medium">{fmtUSD(s.amountUsd)}</p><p className="text-muted-foreground text-[10px]">{s.description}</p></div>
                    <Badge className={s.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : s.status === "processing" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>{s.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-bold">Payouts ({payouts.length})</p></div>
              <div className="space-y-1">
                {payouts.length === 0 && <p className="text-xs text-muted-foreground p-3">Nenhum payout.</p>}
                {payouts.map((po) => (
                  <div key={po.id} className="flex items-center justify-between text-xs p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div><p className="font-medium">{fmtUSD(po.usdAmount)} {po.currency}</p><p className="text-muted-foreground text-[10px]">{po.method} • {new Date(po.createdAt).toLocaleDateString("pt-BR")}{po.providerPayoutId ? ` • NP #${po.providerPayoutId}` : ""}</p>{po.failureReason && <p className="text-red-400 text-[10px]">{po.failureReason}</p>}</div>
                    <div className="flex items-center gap-1">
                      <Badge className={po.status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : po.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/30" : po.status === "awaiting_confirmation" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/30"}>{po.status}</Badge>
                      {po.status === "awaiting_confirmation" && <Button size="sm" variant="ghost" onClick={() => setConfirmPayout(po)}><ShieldCheck className="h-3 w-3" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm 2FA modal */}
      {confirmPayout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setConfirmPayout(null)}>
          <div className="w-full max-w-sm p-6 rounded-2xl" style={{ background: "#0B1120", border: "1px solid rgba(245,158,11,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-5 w-5 text-amber-400" /><h2 className="text-lg font-bold">Confirmar Payout 2FA</h2></div>
            <p className="text-xs text-muted-foreground mb-4">Payout #{confirmPayout.id} • {fmtUSD(confirmPayout.usdAmount)}. Digite o código de verificação enviado por email pelo NowPayments.</p>
            <Input placeholder="Código (ex.: 123456)" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className="mb-3 text-center text-lg tracking-widest" />
            <div className="flex gap-2"><Button className="flex-1" onClick={handleConfirmPayout} disabled={!verifyCode.trim()}>Confirmar</Button><Button variant="outline" onClick={() => setConfirmPayout(null)}>Cancelar</Button></div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl" style={{ background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">{editing ? "Editar Sócio" : "Novo Sócio"}</h2><Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button></div>
            <div className="space-y-3">
              <Field label="Nome *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Função (role)</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                    <option value="dev">Dev</option><option value="operations">Operations</option><option value="investor">Investor</option><option value="partner">Partner</option>
                  </select>
                </div>
              </div>
              <Field label="CPF/CNPJ" value={form.document} onChange={(v) => setForm({ ...form, document: v })} />
              <Field label="% de Split (0-100) *" type="number" value={form.splitPercent} onChange={(v) => setForm({ ...form, splitPercent: v })} />

              <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", padding: "12px" }}>
                <p className="text-xs font-bold text-emerald-400 mb-2">Auto-payout via NowPayments</p>
                <Field label="Carteira de destino (BSC/Ethereum/etc.)" value={form.payoutWallet} onChange={(v) => setForm({ ...form, payoutWallet: v })} placeholder="0x..." />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moeda do payout</label>
                    <select value={form.payoutCurrency} onChange={(e) => setForm({ ...form, payoutCurrency: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                      <option value="usdtbsc">USDT (BSC)</option><option value="usdttrc20">USDT (TRC20)</option><option value="usdterc20">USDT (ERC20)</option><option value="btc">Bitcoin</option><option value="eth">Ethereum</option><option value="bnb">BNB</option>
                    </select>
                  </div>
                  <Field label="Payout mínimo (USD)" type="number" value={form.minPayout} onChange={(v) => setForm({ ...form, minPayout: v })} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-3"><input type="checkbox" checked={form.autoPayout} onChange={(e) => setForm({ ...form, autoPayout: e.target.checked })} className="h-4 w-4" /><span className="text-sm">Auto-payout ativo (envia automaticamente ao atingir o mínimo)</span></label>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm">
                  <option value="active">Ativo (recebe splits)</option><option value="inactive">Inativo</option>
                </select>
              </div>
              <Field label="Observações" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}{saving ? "Salvando..." : (editing ? "Salvar" : "Cadastrar")}</Button>
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
  return (<div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="text-xl font-bold" style={{ color }}>{value}</p></div>);
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (<div className="p-2 rounded text-center" style={{ background: "rgba(255,255,255,0.04)" }}><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-sm font-bold">{value}</p></div>);
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string; }) {
  return (<div><label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>);
}
