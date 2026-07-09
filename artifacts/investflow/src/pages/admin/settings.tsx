import { useEffect, useState } from "react";
import { useGetAdminSettings, useUpdateAdminSettings, getGetAdminSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const handleSave = () => {
    updateSettings.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("Configurações atualizadas com sucesso");
          queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao atualizar configurações"),
      },
    );
  };

  const field = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configurações da Plataforma</h2>
        <p className="text-muted-foreground">Configure parâmetros globais da aplicação.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Ajuste taxas, limites e interruptores do sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Taxa de Saque (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.withdrawalFeePercent ?? 0}
                onChange={(e) => field("withdrawalFeePercent", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comissão de Indicação (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.referralCommissionPercent ?? 0}
                onChange={(e) => field("referralCommissionPercent", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Depósito Mínimo (R$)</label>
              <Input
                type="number"
                value={formData.minDeposit ?? 0}
                onChange={(e) => field("minDeposit", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Saque Mínimo (R$)</label>
              <Input
                type="number"
                value={formData.minWithdrawal ?? 0}
                onChange={(e) => field("minWithdrawal", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saque Máximo (R$)</label>
              <Input
                type="number"
                value={formData.maxWithdrawal ?? 0}
                onChange={(e) => field("maxWithdrawal", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Níveis de Indicação</label>
              <Input
                type="number"
                value={formData.referralLevels ?? 1}
                onChange={(e) => field("referralLevels", parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-medium text-sm">Interruptores do Sistema</h3>

            {[
              { key: "maintenanceMode", label: "Modo Manutenção", desc: "Desabilita acesso dos usuários à plataforma" },
              { key: "depositEnabled", label: "Depósitos Habilitados", desc: "Permite que usuários criem depósitos", defaultVal: true },
              { key: "withdrawalEnabled", label: "Saques Habilitados", desc: "Permite que usuários solicitem saques", defaultVal: true },
            ].map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium">{toggle.label}</p>
                  <p className="text-sm text-muted-foreground">{toggle.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData[toggle.key] ?? toggle.defaultVal ?? false}
                  onChange={(e) => field(toggle.key, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300"
                />
              </div>
            ))}
          </div>

          {/* Auto-approval de saques */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="font-medium text-sm">Aprovação Automática de Saques</h3>
              <p className="text-xs text-muted-foreground mt-1">Cron a cada 10 min aprova saques de baixo valor automaticamente (anti-fraude: acima do limite exige manual).</p>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Habilitar auto-aprovação</p>
                <p className="text-sm text-muted-foreground">Saques elegíveis são aprovados sem intervenção manual</p>
              </div>
              <input
                type="checkbox"
                checked={formData.withdrawalAutoApproveEnabled ?? false}
                onChange={(e) => field("withdrawalAutoApproveEnabled", e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite para auto-aprovação (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.withdrawalAutoApproveLimit ?? 500}
                  onChange={(e) => field("withdrawalAutoApproveLimit", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Saques acima deste valor exigem aprovação manual</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Idade mínima da conta (dias)</label>
                <Input
                  type="number"
                  value={formData.withdrawalAutoApproveMinAccountAgeDays ?? 7}
                  onChange={(e) => field("withdrawalAutoApproveMinAccountAgeDays", parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Usuários mais novos não são elegíveis (anti-fraude)</p>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            {updateSettings.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
