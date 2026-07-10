import { useState } from "react";
import { useLocation } from "wouter";
import {
  useAdminListStrategies,
  useAdminCreateStrategy,
  useAdminApplyYield,
  getAdminListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSmartAccessToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, TrendingUp, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = { active: "Ativo", paused: "Inativo", closed: "Encerrado" };

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BLANK: Record<string, any> = {
  name: "",
  category: "",
  description: "",
  minInvestment: "",
  dailyProfitPercent: "",
  maxReturnPct: "200",
  durationDays: "90",
  status: "active",
};

export default function AdminStrategies() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: strategies, isLoading } = useAdminListStrategies();
  const createStrategy = useAdminCreateStrategy();
  const applyYield = useAdminApplyYield();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [yieldTarget, setYieldTarget] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ ...BLANK });
  const [yieldForm, setYieldForm] = useState({ pct: "", description: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });

  const f = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  // Custom PATCH (generated hook doesn't include new fields)
  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, any> }) => {
      const token = await getSmartAccessToken();
      const res = await fetch(`/api/admin/strategies/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar plano");
      return data;
    },
    onSuccess: () => { invalidate(); },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar plano"),
  });

  const handleCreate = async () => {
    if (!form.name?.trim() || !form.category?.trim() || !form.minInvestment) {
      toast.error("Nome, categoria e valor são obrigatórios");
      return;
    }
    try {
      await createStrategy.mutateAsync({
        data: {
          name: form.name,
          category: form.category,
          description: form.description || "",
          riskLevel: "medium",
          status: form.status || "active",
          sharePrice: Number(form.minInvestment),
          totalShares: 10000,
          minInvestment: Number(form.minInvestment),
          dailyProfitPercent: Number(form.dailyProfitPercent) || 0,
          maxReturnPct: Number(form.maxReturnPct) || 200,
          durationDays: Number(form.durationDays) || 90,
        } as any,
      });
      toast.success("Plano criado com sucesso!");
      setCreateOpen(false);
      setForm({ ...BLANK });
      invalidate();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao criar plano");
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!form.name?.trim() || !form.category?.trim() || !form.minInvestment) {
      toast.error("Nome, categoria e valor são obrigatórios");
      return;
    }
    await patchMutation.mutateAsync({
      id: editTarget.id,
      body: {
        name: form.name,
        category: form.category,
        description: form.description,
        minInvestment: Number(form.minInvestment),
        sharePrice: Number(form.minInvestment),
        dailyProfitPercent: Number(form.dailyProfitPercent) || 0,
        maxReturnPct: Number(form.maxReturnPct) || 200,
        durationDays: Number(form.durationDays) || 90,
        status: form.status,
      },
    });
    toast.success("Plano atualizado com sucesso!");
    setEditTarget(null);
  };

  const handleToggleStatus = (s: any) => {
    const newStatus = s.status === "active" ? "paused" : "active";
    patchMutation.mutate(
      { id: s.id, body: { status: newStatus } },
      { onSuccess: () => toast.success(newStatus === "active" ? "Plano ativado" : "Plano desativado") },
    );
  };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      category: s.category,
      description: s.description ?? "",
      minInvestment: String(s.minInvestment),
      dailyProfitPercent: String(s.dailyProfitPercent ?? ""),
      maxReturnPct: String(s.maxReturnPct ?? "200"),
      durationDays: String(s.durationDays ?? "90"),
      status: s.status,
    });
    setEditTarget(s);
  };

  const handleApplyYield = async () => {
    if (!yieldTarget) return;
    if (!yieldForm.pct || !yieldForm.description?.trim()) {
      toast.error("Percentual e descrição são obrigatórios");
      return;
    }
    try {
      await applyYield.mutateAsync({ id: yieldTarget.id, data: { yieldPercentage: Number(yieldForm.pct), description: yieldForm.description } as any });
      toast.success("Rentabilidade aplicada com sucesso!");
      setYieldTarget(null);
      setYieldForm({ pct: "", description: "" });
      invalidate();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao aplicar rentabilidade");
    }
  };

  const PlanForm = () => (
    <div className="space-y-5 py-2">
      {/* Informações Básicas */}
      <div
        style={{
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "12px",
          padding: "16px",
          background: "rgba(245,158,11,0.03)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
          Informações Básicas
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do Plano *</Label>
            <Input
              value={form.name}
              onChange={e => f("name", e.target.value)}
              placeholder="Ex: Plano Bronze"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Input
              value={form.category}
              onChange={e => f("category", e.target.value)}
              placeholder="Ex: Renda Fixa, Crypto"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={e => f("description", e.target.value)}
              placeholder="Descreva o plano de investimento..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Configuração Financeira */}
      <div
        style={{
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "12px",
          padding: "16px",
          background: "rgba(16,185,129,0.03)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">
          Configuração Financeira
        </p>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label>Valor do Plano (R$) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.minInvestment}
                onChange={e => f("minInvestment", e.target.value)}
                placeholder="100,00"
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rentabilidade Diária (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.dailyProfitPercent}
                  onChange={e => f("dailyProfitPercent", e.target.value)}
                  placeholder="2,97"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Retorno Total Máximo (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.maxReturnPct}
                  onChange={e => f("maxReturnPct", e.target.value)}
                  placeholder="200"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          padding: "16px",
        }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm font-medium">Status do Plano</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {form.status === "active" ? "Plano visível e disponível para investimento" : "Plano oculto dos usuários"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.status === "active"}
            onCheckedChange={v => f("status", v ? "active" : "paused")}
          />
          <span className={`text-sm font-medium ${form.status === "active" ? "text-emerald-400" : "text-muted-foreground"}`}>
            {form.status === "active" ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Planos de Investimento</h2>
          <p className="text-muted-foreground">Gerencie os planos disponíveis na plataforma.</p>
        </div>
        <Button
          onClick={() => { setForm({ ...BLANK }); setCreateOpen(true); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <Card style={{ border: "1px solid rgba(245,158,11,0.15)" }}>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Plano</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Rentab. Diária</TableHead>
                  <TableHead>Retorno Máx.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies?.map(s => (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell>
                      <p className="font-semibold">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{s.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.category}</TableCell>
                    <TableCell className="font-semibold text-amber-400">
                      {fmtBRL(s.minInvestment)}
                    </TableCell>
                    <TableCell>
                      <span className="text-emerald-400 font-semibold">
                        {(s as any).dailyProfitPercent > 0
                          ? `+${Number((s as any).dailyProfitPercent).toFixed(2)}%`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(s as any).maxReturnPct > 0 ? `${Number((s as any).maxReturnPct).toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={s.status === "active"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : "border-slate-600 text-slate-400 bg-slate-800/50"}
                      >
                        {STATUS_LABEL[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={s.status === "active"}
                          onCheckedChange={() => handleToggleStatus(s)}
                          disabled={patchMutation.isPending}
                          title={s.status === "active" ? "Desativar plano" : "Ativar plano"}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                          onClick={() => openEdit(s)}
                          title="Editar plano"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => { setYieldTarget(s); setYieldForm({ pct: "", description: `Rentabilidade de ${s.name}` }); }}
                          title="Aplicar rentabilidade"
                        >
                          <TrendingUp className="h-3 w-3" />
                          Rentabilidade
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!strategies?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum plano cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Plano de Investimento</DialogTitle>
          </DialogHeader>
          <PlanForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createStrategy.isPending}>
              {createStrategy.isPending ? "Criando..." : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
          </DialogHeader>
          <PlanForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={patchMutation.isPending}>
              {patchMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Yield dialog */}
      <Dialog open={!!yieldTarget} onOpenChange={v => !v && setYieldTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Rentabilidade — {yieldTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Percentual de Rentabilidade (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={yieldForm.pct}
                  onChange={e => setYieldForm(f => ({ ...f, pct: e.target.value }))}
                  placeholder="Ex: 2,97"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={yieldForm.description}
                onChange={e => setYieldForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva a rentabilidade..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYieldTarget(null)}>Cancelar</Button>
            <Button onClick={handleApplyYield} disabled={applyYield.isPending}>
              {applyYield.isPending ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
