import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useAdminGetDailyProfitSettings,
  useAdminSaveDailyProfitSettings,
  useAdminExecuteDailyProfit,
  useAdminGetDailyProfitHistory,
  getAdminGetDailyProfitSettingsQueryKey,
  getAdminGetDailyProfitHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, History, TrendingUp, Users, DollarSign, Clock, Zap, Calendar } from "lucide-react";

const DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export default function AdminDailyProfit() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useAdminGetDailyProfitSettings();
  const { data: history, isLoading: historyLoading } = useAdminGetDailyProfitHistory({ page: 1, limit: 20 });

  const saveSettings = useAdminSaveDailyProfitSettings();
  const executeProfit = useAdminExecuteDailyProfit();

  const [percentage, setPercentage] = useState<string>("");
  const [executionTime, setExecutionTime] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [lastResult, setLastResult] = useState<{
    processed: number; skipped: number; errors: number; totalProfit: number; duration: number;
  } | null>(null);

  // Sync form state once settings are loaded
  if (settings && !initialized) {
    setPercentage(String(settings.percentage));
    setExecutionTime(settings.executionTime);
    setActive(settings.active);
    setSelectedDays(settings.days ?? []);
    setInitialized(true);
  }

  const toggleDay = (dow: number) => {
    setSelectedDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow],
    );
  };

  const handleSave = async () => {
    const pct = parseFloat(percentage);
    if (!percentage || isNaN(pct) || pct < 0.01 || pct > 100) {
      toast.error("Percentual deve ser entre 0,01% e 100%");
      return;
    }
    if (selectedDays.length === 0) {
      toast.error("Selecione pelo menos um dia da semana");
      return;
    }
    try {
      await saveSettings.mutateAsync({
        data: { percentage: pct, executionTime, active, days: selectedDays },
      });
      toast.success("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: getAdminGetDailyProfitSettingsQueryKey() });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao salvar configurações");
    }
  };

  // Manual trigger — kept ONLY as an emergency/test override.
  // The cron runs this automatically every day at the configured time.
  const handleExecute = async () => {
    try {
      const result = await executeProfit.mutateAsync(undefined as any);
      setLastResult(result);
      if (result.processed > 0) {
        toast.success(
          `Execução manual concluída: ${result.processed} posições, R$ ${result.totalProfit.toFixed(2)} distribuídos`,
        );
      } else if (result.skipped > 0) {
        toast.info(`Nenhuma posição nova: ${result.skipped} já receberam lucro hoje`);
      } else {
        toast.warning("Nenhuma posição ativa encontrada");
      }
      queryClient.invalidateQueries({ queryKey: getAdminGetDailyProfitHistoryQueryKey() });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao executar");
    }
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Rendimento Diário</h2>
          <p className="text-muted-foreground">
            Automação de rendimento — executa sozinho todo dia no horário configurado.
          </p>
        </div>
        <Badge
          variant={active ? "default" : "secondary"}
          className="text-sm px-3 py-1 flex items-center gap-1.5"
        >
          <Zap className="h-3 w-3" />
          {active ? "Automático" : "Pausado"}
        </Badge>
      </div>

      {/* Automation status banner */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-400">Rendimento 100% automático</p>
          <p className="text-xs text-muted-foreground mt-1">
            O sistema credita o rendimento diário a todas as posições ativas, todos os dias,
            no horário configurado ({executionTime || "18:00"}h). Cada estratégia usa seu próprio
            % diário (definido no cadastro da estratégia) com fallback para o % global abaixo.
            Não é necessário clicar em nada — o cron verifica a cada minuto e executa quando chega a hora.
          </p>
          {selectedDays.length === 7 && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Roda todos os 7 dias da semana
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Configuração
            </CardTitle>
            <CardDescription>
              % global (fallback) e horário da execução automática diária.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <>
                {/* Percentage */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Percentual global diário (%) *
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      className="pr-8"
                      placeholder="Ex: 1.5"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado quando a estratégia não tem % próprio. Cada estratégia pode ter seu % diário.
                  </p>
                  {percentage && !isNaN(parseFloat(percentage)) && (
                    <p className="text-xs text-emerald-400">
                      Exemplo: R$ 1.000 investidos → R$ {(1000 * parseFloat(percentage) / 100).toFixed(2)} de lucro/dia
                    </p>
                  )}
                </div>

                {/* Execution time */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Horário de execução automática
                  </label>
                  <Input
                    type="time"
                    value={executionTime}
                    onChange={(e) => setExecutionTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    O cron roda a cada minuto e executa quando passa deste horário (janela diária, não minuto exato).
                  </p>
                </div>

                {/* Days of week */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dias da semana *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS.map((day) => {
                      const selected = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`px-3 py-2 rounded-md text-sm font-medium border transition-all text-left ${
                            selected
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${selected ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                            {day.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                  <div>
                    <p className="text-sm font-medium">Automação ativa</p>
                    <p className="text-xs text-muted-foreground">
                      Quando desativado, o rendimento não é creditado automaticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-muted"}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saveSettings.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveSettings.isPending ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Status + last execution */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Última Execução Automática
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!historyLoading && history && history.data.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium text-sm">{new Date(history.data[0].date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="rounded-md bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">% aplicado</p>
                    <p className="font-medium text-sm text-emerald-400">{history.data[0].percentage}%</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Posições</p>
                    <p className="font-bold text-lg text-emerald-400">{history.data[0].usersCount}</p>
                  </div>
                  <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total</p>
                    <p className="font-bold text-lg text-amber-400">R$ {fmtBRL(history.data[0].totalProfit)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {historyLoading ? "Carregando..." : "Nenhuma execução registrada ainda. O cron rodará automaticamente no horário configurado."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Emergency manual trigger (collapsed/minimal) */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" />
                Execução de Teste (opcional)
              </CardTitle>
              <CardDescription className="text-xs">
                Apenas para validação. O sistema já roda sozinho — não é necessário usar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleExecute}
                disabled={executeProfit.isPending}
              >
                {executeProfit.isPending ? "Executando..." : "Executar agora (teste)"}
              </Button>
              {lastResult !== null && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {lastResult.processed} processadas · R$ {fmtBRL(lastResult.totalProfit)} distribuídos · {lastResult.duration}ms
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de Execuções Automáticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead>Posições Processadas</TableHead>
                  <TableHead className="text-right">Total Distribuído (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.data.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">
                      {new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        weekday: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                        {row.percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>{row.usersCount}</TableCell>
                    <TableCell className="text-right font-medium text-amber-400">
                      R$ {fmtBRL(row.totalProfit)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!history?.data || history.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma execução registrada ainda. O cron executará automaticamente no horário configurado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
