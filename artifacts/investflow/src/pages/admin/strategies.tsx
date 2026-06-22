import { useState } from "react";
import { useLocation } from "wouter";
import {
  useAdminListStrategies,
  useAdminCreateStrategy,
  useAdminUpdateStrategy,
  useAdminApplyYield,
  getAdminListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const RISK_LABEL: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto" };
const STATUS_LABEL: Record<string, string> = { active: "Ativa", paused: "Pausada", closed: "Encerrada" };

export default function AdminStrategies() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: strategies, isLoading } = useAdminListStrategies();

  const createStrategy = useAdminCreateStrategy();
  const updateStrategy = useAdminUpdateStrategy();
  const applyYield = useAdminApplyYield();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [yieldId, setYieldId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const field = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (!formData.name?.trim() || !formData.category?.trim()) {
      toast.error("Nome e categoria são obrigatórios");
      return;
    }
    const payload = {
      name: formData.name,
      category: formData.category,
      description: formData.description || "",
      riskLevel: formData.riskLevel || "medium",
      status: formData.status || "active",
      sharePrice: Number(formData.sharePrice) || 100,
      totalShares: Number(formData.totalShares) || 1000,
      minInvestment: Number(formData.minInvestment) || 100,
    };
    console.log("[AdminStrategies] Payload criação:", payload);
    try {
      const result = await createStrategy.mutateAsync({ data: payload as any });
      console.log("[AdminStrategies] Resposta criação:", result);
      toast.success("Estratégia criada com sucesso!");
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      navigate(`/admin/strategies/${result.id}`);
    } catch (err: any) {
      console.error("[AdminStrategies] Erro ao criar estratégia:", err);
      toast.error(err?.data?.error || err?.message || "Erro ao criar estratégia");
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const payload: Record<string, any> = {};
    if (formData.name !== undefined) payload.name = formData.name;
    if (formData.description !== undefined) payload.description = formData.description;
    if (formData.riskLevel !== undefined) payload.riskLevel = formData.riskLevel;
    if (formData.category !== undefined) payload.category = formData.category;
    if (formData.minInvestment !== undefined) payload.minInvestment = Number(formData.minInvestment);
    if (formData.sharePrice !== undefined) payload.sharePrice = Number(formData.sharePrice);
    if (formData.status !== undefined) payload.status = formData.status;
    console.log("[AdminStrategies] Payload edição:", payload);
    try {
      const result = await updateStrategy.mutateAsync({ id: editingId, data: payload as any });
      console.log("[AdminStrategies] Resposta edição:", result);
      toast.success("Estratégia atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      setEditingId(null);
      navigate(`/admin/strategies/${editingId}`);
    } catch (err: any) {
      console.error("[AdminStrategies] Erro ao atualizar estratégia:", err);
      toast.error(err?.data?.error || err?.message || "Erro ao atualizar estratégia");
    }
  };

  const handleApplyYield = async () => {
    if (!yieldId) return;
    if (!formData.yieldPercentage || !formData.description?.trim()) {
      toast.error("Percentual e descrição são obrigatórios");
      return;
    }
    const payload = {
      yieldPercentage: Number(formData.yieldPercentage),
      description: formData.description,
    };
    console.log("[AdminStrategies] Payload yield:", payload);
    try {
      await applyYield.mutateAsync({ id: yieldId, data: payload as any });
      console.log("[AdminStrategies] Yield aplicado com sucesso");
      toast.success("Rentabilidade aplicada com sucesso!");
      setYieldId(null);
      queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
    } catch (err: any) {
      console.error("[AdminStrategies] Erro ao aplicar yield:", err);
      toast.error(err?.data?.error || err?.message || "Erro ao aplicar rentabilidade");
    }
  };

  const openEdit = (strat: any) => {
    setFormData({ ...strat });
    setEditingId(strat.id);
  };

  const openYield = (strat: any) => {
    setFormData({ yieldPercentage: "", description: `Rentabilidade de ${strat.name}` });
    setYieldId(strat.id);
  };

  const openCreate = () => {
    setFormData({ status: "active", riskLevel: "medium", sharePrice: 100, totalShares: 1000, minInvestment: 100 });
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Estratégias</h2>
          <p className="text-muted-foreground">Crie e gerencie estratégias de investimento.</p>
        </div>
        <Button onClick={openCreate}>Nova Estratégia</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preco da Cota</TableHead>
                  <TableHead>Cotas Disponíveis</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies?.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/admin/strategies/${s.id}`)}
                  >
                    <TableCell className="text-muted-foreground">{s.id}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.category}</TableCell>
                    <TableCell>R$ {Number(s.sharePrice ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{s.availableShares ?? 0} / {s.totalShares ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={s.riskLevel === "high" ? "destructive" : s.riskLevel === "low" ? "secondary" : "outline"}>
                        {RISK_LABEL[s.riskLevel] || s.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABEL[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right space-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm" onClick={() => openYield(s)}>
                        Rentabilidade
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!strategies?.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma estratégia cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingId}
        onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setEditingId(null); } }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Estratégia" : "Nova Estratégia"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => field("name", e.target.value)}
                  placeholder="Nome da estratégia"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria *</label>
                <Input
                  value={formData.category || ""}
                  onChange={(e) => field("category", e.target.value)}
                  placeholder="Ex: Crypto, Forex"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Descreva a estratégia..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Risco</label>
                <Select value={formData.riskLevel || "medium"} onValueChange={(v) => field("riskLevel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status || "active"} onValueChange={(v) => field("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Preco da Cota (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sharePrice ?? ""}
                  onChange={(e) => field("sharePrice", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total de Cotas</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.totalShares ?? ""}
                  onChange={(e) => field("totalShares", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Investimento Mínimo (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minInvestment ?? ""}
                  onChange={(e) => field("minInvestment", e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingId(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={createStrategy.isPending || updateStrategy.isPending}
            >
              {createStrategy.isPending || updateStrategy.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Yield Dialog */}
      <Dialog open={!!yieldId} onOpenChange={(open) => !open && setYieldId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Rentabilidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Percentual de Rentabilidade (%) *</label>
              <Input
                type="number"
                step="0.01"
                value={formData.yieldPercentage ?? ""}
                onChange={(e) => field("yieldPercentage", e.target.value)}
                placeholder="Ex: 2.5"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição *</label>
              <Input
                value={formData.description || ""}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Descreva a rentabilidade..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYieldId(null)}>Cancelar</Button>
            <Button onClick={handleApplyYield} disabled={applyYield.isPending}>
              {applyYield.isPending ? "Aplicando..." : "Aplicar Rentabilidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
