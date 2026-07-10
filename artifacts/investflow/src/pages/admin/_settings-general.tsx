import { useEffect, useState, useRef } from "react";
import { useGetAdminSettings, useUpdateAdminSettings, getGetAdminSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { clearSiteConfigCache } from "@/lib/site-config";

export function GeneralSettingsContent({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  const [formData, setFormData] = useState<any>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Arquivo muito grande. Máximo 500KB.");
      return;
    }
    setUploadingLogo(true);
    try {
      // Converter para base64 data URL
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        // Enviar para o backend
        try {
          const result = await apiPost<{ siteLogoUrl: string }>("/api/admin/settings/upload-logo", { image: dataUrl });
          field("siteLogoUrl", result.siteLogoUrl);
          // Limpar cache do site-config no frontend
          toast.success("Logo enviada com sucesso! Salve as configurações.");
        } catch (err: any) {
          toast.error(err?.message || "Erro ao enviar logo");
          setLogoPreview(null);
        } finally {
          setUploadingLogo(false);
        }
      };
      reader.onerror = () => {
        toast.error("Erro ao ler arquivo");
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err?.message || "Erro no upload");
      setUploadingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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
          clearSiteConfigCache(); // Limpar cache para que nome/logo atualizem no header/sidebar
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao atualizar configurações"),
      },
    );
  };

  const field = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações da Plataforma</h2>
          <p className="text-muted-foreground">Configure parâmetros globais da aplicação.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Taxas & Limites</CardTitle>
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

          {/* Identidade do site */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-medium text-sm">Identidade do Site</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do site</label>
                <Input
                  value={formData.siteName ?? ""}
                  onChange={(e) => field("siteName", e.target.value)}
                  placeholder="Alliance Group"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL da logo (opcional)</label>
                <Input
                  value={formData.siteLogoUrl ?? ""}
                  onChange={(e) => field("siteLogoUrl", e.target.value)}
                  placeholder="/logo.png"
                />
                <p className="text-xs text-muted-foreground">Pode usar upload abaixo ou digitar uma URL</p>
              </div>
            </div>
            {/* Upload de logo */}
            <div className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  background: "#0B1120",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.1)",
                  overflow: "hidden",
                }}
              >
                <img
                  src={logoPreview || formData.siteLogoUrl || "/logo.png"}
                  alt="Preview"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium mb-1">Fazer upload da logo</p>
                <p className="text-[10px] text-muted-foreground mb-2">PNG, JPG ou SVG. Máx 500KB. Recomendado: 200x200px.</p>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
                      📁 Escolher arquivo
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {uploadingLogo && <span className="text-xs text-muted-foreground self-center">Enviando...</span>}
                  {logoPreview && !uploadingLogo && (
                    <button
                      onClick={() => { setLogoPreview(null); field("siteLogoUrl", "/logo.png"); }}
                      className="text-xs text-red-400 hover:text-red-300 self-center"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Suporte / Contato */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-medium text-sm">Suporte / Contato</h3>
            <p className="text-xs text-muted-foreground">Estes dados aparecem na página de Suporte do usuário. Deixe vazio para esconder o canal.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp</label>
                <Input
                  value={formData.supportWhatsapp ?? ""}
                  onChange={(e) => field("supportWhatsapp", e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail de suporte</label>
                <Input
                  value={formData.supportEmail ?? ""}
                  onChange={(e) => field("supportEmail", e.target.value)}
                  placeholder="suporte@flashymining.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={formData.supportPhone ?? ""}
                  onChange={(e) => field("supportPhone", e.target.value)}
                  placeholder="+55 11 3333-3333"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telegram</label>
                <Input
                  value={formData.supportTelegram ?? ""}
                  onChange={(e) => field("supportTelegram", e.target.value)}
                  placeholder="@seucanal"
                />
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
