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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Save, History, TrendingUp, Users, DollarSign, Clock } from "lucide-react";

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

  const handleExecute = async () => {
    try {
      const result = await executeProfit.mutateAsync(undefined as any);
      setLastResult(result);
      if (result.processed > 0) {
        toast.success(
          `Distribuição concluída: ${result.processed} posições processadas, R$ ${result.totalProfit.toFixed(2)} distribuídos`,
        );
      } else if (result.skipped > 0) {
        toast.info(`Nenhuma posição nova: ${result.skipped} já receberam lucro hoje`);
      } else {
        toast.warning("Nenhuma posição ativa encontrada para distribuir");
      }
      queryClient.invalidateQueries({ queryKey: getAdminGetDailyProfitHistoryQueryKey() });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao executar distribuição");
    }
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Distribuir Lucro Diário</h2>
          <p className="text-muted-foreground">
            Configure e execute a distribuição automática de rendimentos.
          </p>
        </div>
        <Badge
          variant={active ? "default" : "secondary"}
          className="text-sm px-3 py-1"
        >
          {active ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Configurações de Distribuição
            </CardTitle>
            <CardDescription>
              Define o percentual e os dias em que o rendimento será creditado.
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
                    Percentual diário (%) *
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
                    Mínimo: 0,01% · Máximo: 100%
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
                    Horário de execução
                  </label>
                  <Input
                    type="time"
                    value={executionTime}
                    onChange={(e) => setExecutionTime(e.target.value)}
                  />
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
                    <p className="text-sm font-medium">Status da automação</p>
                    <p className="text-xs text-muted-foreground">
                      Quando inativo, o cron não executa automaticamente.
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

        {/* Manual Execute + Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-4 w-4 text-amber-400" />
                Execução Manual
              </CardTitle>
              <CardDescription>
                Executa a distribuição imediatamente, respeitando a proteção contra duplicidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-400 font-medium">Atenção</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A execução manual usa as mesmas regras do cron automático. Se uma posição já recebeu lucro hoje, ela será ignorada automaticamente.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    disabled={executeProfit.isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {executeProfit.isPending ? "Executando..." : "Executar Agora"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar distribuição</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá distribuir rendimentos para todas as posições ativas que ainda não receberam lucro hoje. O percentual atual de <strong>{percentage || settings?.percentage}%</strong> será aplicado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleExecute}>
                      Confirmar Execução
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <p><span className="text-foreground font-medium">Fórmula:</span> lucro = valor_investido × (percentual / 100)</p>
                <p className="text-emerald-400">Investimento R$ 100 × 1,5% = R$ 1,50 / dia</p>
              </div>
            </CardContent>
          </Card>

          {/* Execution result */}
          {lastResult !== null && (
            <Card className={`border ${lastResult.processed > 0 ? "border-emerald-500/30" : "border-amber-500/30"}`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${lastResult.processed > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  <Play className="h-3.5 w-3.5" />
                  Resultado da Última Execução
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Posições Processadas</p>
                    <p className="font-bold text-lg text-emerald-400">{lastResult.processed}</p>
                  </div>
                  <div className="rounded-md bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Já tinham recebido</p>
                    <p className="font-bold text-lg text-muted-foreground">{lastResult.skipped}</p>
                  </div>
                  <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total Distribuído</p>
                    <p className="font-bold text-lg text-amber-400">R$ {fmtBRL(lastResult.totalProfit)}</p>
                  </div>
                  <div className="rounded-md bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Tempo</p>
                    <p className="font-bold text-lg">{lastResult.duration}ms</p>
                  </div>
                </div>
                {lastResult.errors > 0 && (
                  <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                    <p className="text-xs text-red-400 font-medium">{lastResult.errors} erro(s) durante a execução. Verifique os logs do servidor.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick stats from history */}
          {!historyLoading && history && history.data.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Última Execução</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const last = history.data[0];
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Data</p>
                        <p className="font-medium text-sm">{new Date(last.date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="rounded-md bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Percentual</p>
                        <p className="font-medium text-sm text-emerald-400">{last.percentage}%</p>
                      </div>
                      <div className="rounded-md bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Posições</p>
                        <p className="font-medium text-sm">{last.usersCount}</p>
                      </div>
                      <div className="rounded-md bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total</p>
                        <p className="font-medium text-sm text-amber-400">R$ {fmtBRL(last.totalProfit)}</p>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de Distribuições
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
                      Nenhuma distribuição registrada ainda.
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
