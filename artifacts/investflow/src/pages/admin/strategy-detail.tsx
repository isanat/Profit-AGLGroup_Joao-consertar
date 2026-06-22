import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useAdminListStrategies,
  useAdminUpdateStrategy,
  useAdminApplyYield,
  getAdminListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, Users, DollarSign, BarChart3, Edit, Percent } from "lucide-react";

const RISK_LABEL: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto" };
const STATUS_LABEL: Record<string, string> = { active: "Ativa", paused: "Pausada", closed: "Encerrada" };

export default function AdminStrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const strategyId = parseInt(id ?? "0", 10);
  const queryClient = useQueryClient();

  const { data: strategies, isLoading } = useAdminListStrategies();
  const strategy = strategies?.find((s) => s.id === strategyId);

  const updateStrategy = useAdminUpdateStrategy();
  const applyYield = useAdminApplyYield();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isYieldOpen, setIsYieldOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const field = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const openEdit = () => {
    if (!strategy) return;
    setFormData({ ...strategy });
    setIsEditOpen(true);
  };

  const openYield = () => {
    if (!strategy) return;
    setFormData({ yieldPercentage: "", description: `Rentabilidade de ${strategy.name}` });
    setIsYieldOpen(true);
  };

  const handleUpdate = async () => {
    const payload: Record<string, any> = {};
    if (formData.name !== undefined) payload.name = formData.name;
    if (formData.description !== undefined) payload.description = formData.description;
    if (formData.riskLevel !== undefined) payload.riskLevel = formData.riskLevel;
    if (formData.category !== undefined) payload.category = formData.category;
    if (formData.minInvestment !== undefined) payload.minInvestment = Number(formData.minInvestment);
    if (formData.sharePrice !== undefined) payload.sharePrice = Number(formData.sharePrice);
    if (formData.status !== undefined) payload.status = formData.status;

    console.log("[StrategyDetail] Payload edição:", payload);
    try {
      const result = await updateStrategy.mutateAsync({ id: strategyId, data: payload as any });
      console.log("[StrategyDetail] Resposta edição:", result);
      toast.success("Estratégia atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      setIsEditOpen(false);
    } catch (err: any) {
      console.error("[StrategyDetail] Erro ao atualizar:", err);
      toast.error(err?.data?.error || err?.message || "Erro ao atualizar estratégia");
    }
  };

  const handleApplyYield = async () => {
    if (!formData.yieldPercentage || !formData.description?.trim()) {
      toast.error("Percentual e descrição são obrigatórios");
      return;
    }
    const payload = {
      yieldPercentage: Number(formData.yieldPercentage),
      description: formData.description,
    };
    console.log("[StrategyDetail] Payload yield:", payload);
    try {
      await applyYield.mutateAsync({ id: strategyId, data: payload as any });
      console.log("[StrategyDetail] Yield aplicado");
      toast.success("Rentabilidade aplicada com sucesso!");
      queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      setIsYieldOpen(false);
    } catch (err: any) {
      console.error("[StrategyDetail] Erro ao aplicar yield:", err);
      toast.error(err?.data?.error || err?.message || "Erro ao aplicar rentabilidade");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-muted-foreground text-lg">Estratégia não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/admin/strategies")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista
        </Button>
      </div>
    );
  }

  const stats = [
    {
      label: "Preco da Cota",
      value: `R$ ${strategy.sharePrice.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-400",
    },
    {
      label: "AUM Total",
      value: `R$ ${strategy.aum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: BarChart3,
      color: "text-amber-400",
    },
    {
      label: "Cotas Disponíveis",
      value: `${strategy.availableShares} / ${strategy.totalShares}`,
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Retorno Total",
      value: `${strategy.totalReturnPct.toFixed(2)}%`,
      icon: TrendingUp,
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => navigate("/admin/strategies")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Estratégias
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{strategy.name}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{strategy.category}</span>
            <span>·</span>
            <Badge variant={strategy.riskLevel === "high" ? "destructive" : strategy.riskLevel === "low" ? "secondary" : "outline"}>
              {RISK_LABEL[strategy.riskLevel] || strategy.riskLevel}
            </Badge>
            <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
              {STATUS_LABEL[strategy.status] || strategy.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openYield}>
            <Percent className="mr-2 h-4 w-4" />
            Rentabilidade
          </Button>
          <Button onClick={openEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {strategy.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
                <p className="text-sm leading-relaxed">{strategy.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Investimento Mínimo</p>
                <p className="font-medium">R$ {strategy.minInvestment.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Retorno Mensal</p>
                <p className="font-medium text-emerald-400">{strategy.monthlyReturnPct.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Max Drawdown</p>
                <p className="font-medium text-red-400">-{strategy.maxDrawdown.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Início</p>
                <p className="font-medium">{strategy.startDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cotas e Capital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de Cotas</span>
                <span className="font-medium">{strategy.totalShares.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cotas Disponíveis</span>
                <span className="font-medium text-emerald-400">{strategy.availableShares.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cotas Vendidas</span>
                <span className="font-medium">{(strategy.totalShares - strategy.availableShares).toLocaleString("pt-BR")}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${strategy.totalShares > 0
                      ? ((strategy.totalShares - strategy.availableShares) / strategy.totalShares) * 100
                      : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">AUM (Assets Under Management)</span>
                <span className="font-bold text-amber-400">
                  R$ {strategy.aum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => !open && setIsEditOpen(false)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Estratégia</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={formData.name || ""} onChange={(e) => field("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Input value={formData.category || ""} onChange={(e) => field("category", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={formData.description || ""} onChange={(e) => field("description", e.target.value)} rows={3} />
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
                <Input type="number" step="0.01" min="0" value={formData.sharePrice ?? ""} onChange={(e) => field("sharePrice", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Investimento Mínimo (R$)</label>
              <Input type="number" step="0.01" min="0" value={formData.minInvestment ?? ""} onChange={(e) => field("minInvestment", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateStrategy.isPending}>
              {updateStrategy.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yield Dialog */}
      <Dialog open={isYieldOpen} onOpenChange={(open) => !open && setIsYieldOpen(false)}>
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
            <Button variant="outline" onClick={() => setIsYieldOpen(false)}>Cancelar</Button>
            <Button onClick={handleApplyYield} disabled={applyYield.isPending}>
              {applyYield.isPending ? "Aplicando..." : "Aplicar Rentabilidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
