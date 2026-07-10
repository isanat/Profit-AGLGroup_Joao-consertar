import { useState } from "react";
import {
  useAdminListUsers,
  useAdminUpdateUser,
  getAdminListUsersQueryKey,
  type AdminUserUpdateRole,
  type AdminUserUpdateStatus,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { X, Save, KeyRound, Wallet, Loader2, Copy, CheckCircle2, User, Mail, Phone, Globe, Shield, Calendar, TrendingUp, Hash } from "lucide-react";
import { apiPost } from "@/lib/api";

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useAdminListUsers(
    {
      search: search || undefined,
      status: statusFilter !== "all" ? (statusFilter as any) : undefined,
      page,
      limit: 20,
    },
  );

  const updateUser = useAdminUpdateUser();
  const [editingUser, setEditingUser] = useState<any>(null);

  const handleUpdate = () => {
    if (!editingUser) return;
    updateUser.mutate(
      {
        id: editingUser.id,
        data: {
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone ?? null,
          country: editingUser.country ?? null,
          role: editingUser.role as AdminUserUpdateRole,
          status: editingUser.status as AdminUserUpdateStatus,
          balance: editingUser.balance,
        },
      },
      {
        onSuccess: () => {
          toast.success("Usuário atualizado com sucesso");
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao atualizar"),
      },
    );
  };

  // Reset de senha embutido
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleResetPassword = async () => {
    if (!editingUser) return;
    setResetting(true);
    try {
      const result = await apiPost<{ resetLink: string; message: string }>(`/api/admin/users/${editingUser.id}/reset-password`, {});
      setResetLink(result.resetLink);
      toast.success("Link de reset gerado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar link");
    } finally {
      setResetting(false);
    }
  };

  const copyLink = () => {
    if (!resetLink) return;
    navigator.clipboard.writeText(resetLink);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  // Ajuste de saldo
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjustBalance = async () => {
    if (!editingUser) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt === 0) { toast.error("Valor inválido"); return; }
    setAdjusting(true);
    try {
      const result = await apiPost<{ balanceAfter: number; message: string }>(`/api/admin/users/${editingUser.id}/adjust-balance`, { amount: amt, reason: adjustReason });
      toast.success(`Saldo ajustado: ${fmtBRL(result.balanceAfter)}`);
      setEditingUser({ ...editingUser, balance: result.balanceAfter });
      setAdjustAmount(""); setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao ajustar saldo");
    } finally {
      setAdjusting(false);
    }
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setResetLink(null);
    setAdjustAmount("");
    setAdjustReason("");
  };

  const closeEdit = () => {
    setEditingUser(null);
    setResetLink(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Usuários</h2>
        <p className="text-muted-foreground">Visualize e administre contas de usuários — dados, saldo, status e reset de senha.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.data?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="font-medium">{fmtBRL(Number(u.balance ?? 0))}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase">{u.role}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={u.status === "active" ? "default" : "destructive"}>{u.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Administrar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!usersData?.data || usersData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {usersData && usersData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <span className="text-sm text-muted-foreground">Página {page} de {usersData.totalPages}</span>
                  <Button variant="outline" disabled={page === usersData.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Drawer de administração do usuário ─── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={closeEdit}>
          <div className="w-full max-w-xl h-full overflow-y-auto" style={{ background: "#0B1120", borderLeft: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border" style={{ background: "#0B1120" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center font-bold text-emerald-400">
                  {editingUser.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{editingUser.name}</h2>
                  <p className="text-xs text-muted-foreground">ID #{editingUser.id} • {editingUser.email}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={closeEdit}><X className="h-4 w-4" /></Button>
            </div>

            <div className="p-5 space-y-6">
              {/* ─── Estatísticas rápidas ─── */}
              <div className="grid grid-cols-3 gap-2">
                <StatBox icon={<Wallet className="h-3.5 w-3.5" />} label="Saldo" value={fmtBRL(Number(editingUser.balance ?? 0))} color="#10b981" />
                <StatBox icon={<TrendingUp className="h-3.5 w-3.5" />} label="Investido" value={fmtBRL(Number(editingUser.totalInvested ?? 0))} color="#f59e0b" />
                <StatBox icon={<TrendingUp className="h-3.5 w-3.5" />} label="Rendimento" value={fmtBRL(Number(editingUser.totalYield ?? 0))} color="#3b82f6" />
              </div>

              {/* ─── Dados cadastrais ─── */}
              <Section title="Dados Cadastrais" icon={<User className="h-4 w-4" />}>
                <FieldRow label="Nome" icon={<User className="h-3.5 w-3.5" />}>
                  <Input value={editingUser.name ?? ""} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
                </FieldRow>
                <FieldRow label="E-mail" icon={<Mail className="h-3.5 w-3.5" />}>
                  <Input type="email" value={editingUser.email ?? ""} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} />
                </FieldRow>
                <FieldRow label="Telefone" icon={<Phone className="h-3.5 w-3.5" />}>
                  <Input value={editingUser.phone ?? ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </FieldRow>
                <FieldRow label="País" icon={<Globe className="h-3.5 w-3.5" />}>
                  <Input value={editingUser.country ?? ""} onChange={(e) => setEditingUser({ ...editingUser, country: e.target.value })} placeholder="BR" />
                </FieldRow>
              </Section>

              {/* ─── Conta & Status ─── */}
              <Section title="Conta & Status" icon={<Shield className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Perfil">
                    <Select value={editingUser.role} onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Status">
                    <Select value={editingUser.status} onValueChange={(val) => setEditingUser({ ...editingUser, status: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <InfoLine label="E-mail verificado" value={editingUser.emailVerified ? "Sim" : "Não"} />
                  <InfoLine label="2FA" value={editingUser.twoFactorEnabled ? "Ativo" : "Inativo"} />
                </div>
              </Section>

              {/* ─── Saldo ─── */}
              <Section title="Saldo & Ajustes" icon={<Wallet className="h-4 w-4" />}>
                <FieldRow label="Saldo atual (R$) — edição direta">
                  <Input type="number" step="0.01" value={editingUser.balance ?? 0}
                    onChange={(e) => setEditingUser({ ...editingUser, balance: parseFloat(e.target.value) || 0 })} />
                </FieldRow>

                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Ajuste rápido (credita/debita com auditoria)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" step="0.01" placeholder="Valor" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                    <Input className="col-span-2" placeholder="Motivo (ex: bonus de cortesia)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => { setAdjustAmount("100"); }} disabled={adjusting}>+R$100</Button>
                    <Button size="sm" variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => { setAdjustAmount("500"); }} disabled={adjusting}>+R$500</Button>
                    <Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => { setAdjustAmount(String(-(Number(editingUser.balance ?? 0)))); }} disabled={adjusting}>Zerar</Button>
                  </div>
                  <Button className="w-full" size="sm" onClick={handleAdjustBalance} disabled={adjusting || !adjustAmount}>
                    {adjusting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    {adjusting ? "Ajustando..." : "Aplicar Ajuste"}
                  </Button>
                </div>
              </Section>

              {/* ─── Reset de Senha ─── */}
              <Section title="Reset de Senha" icon={<KeyRound className="h-4 w-4" />}>
                <p className="text-xs text-muted-foreground mb-2">Gera um link único de redefinição de senha para este usuário. O link expira em 1 hora.</p>
                <Button variant="outline" className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 mr-1" />}
                  {resetting ? "Gerando..." : "Gerar Link de Reset"}
                </Button>
                {resetLink && (
                  <div className="mt-2 p-2 rounded-md" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={resetLink} className="text-xs font-mono flex-1" />
                      <Button size="sm" variant="ghost" onClick={copyLink}>
                        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Copie e envie ao usuário (email, WhatsApp, etc.)</p>
                  </div>
                )}
              </Section>

              {/* ─── Indicação & Metadados ─── */}
              <Section title="Indicação & Metadados" icon={<Hash className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <InfoLine label="Código de indicação" value={editingUser.referralCode || "—"} mono />
                  <InfoLine label="Indicado por (ID)" value={editingUser.referredBy ? `#${editingUser.referredBy}` : "—"} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <InfoLine label="Cadastro" value={fmtDate(editingUser.createdAt)} icon={<Calendar className="h-3 w-3" />} />
                  <InfoLine label="Último login" value={fmtDate(editingUser.lastLoginAt)} icon={<Calendar className="h-3 w-3" />} />
                </div>
              </Section>

              {/* ─── Ações ─── */}
              <div className="sticky bottom-0 flex gap-2 pt-4 border-t border-border" style={{ background: "#0B1120" }}>
                <Button variant="outline" className="flex-1" onClick={closeEdit}>Cancelar</Button>
                <Button className="flex-1" onClick={handleUpdate} disabled={updateUser.isPending}>
                  {updateUser.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {updateUser.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <div className="flex items-center gap-1 mb-1" style={{ color }}>{icon}<span className="text-[10px] uppercase tracking-wide">{label}</span></div>
      <p className="font-bold text-sm" style={{ color }}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">{icon}{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">{icon}{label}</label>
      {children}
    </div>
  );
}

function InfoLine({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
      <span className="text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
