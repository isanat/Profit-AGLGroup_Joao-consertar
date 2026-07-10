import { useState } from "react";
import {
  useAdminListDeposits,
  useAdminConfirmDeposit,
  getAdminListDepositsQueryKey,
  type ConfirmDepositInputStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  usdt_bep20: "USDT BEP20",
  bitcoin: "Bitcoin",
  usdc: "USDC",
  bnb: "BNB",
};

export default function AdminDeposits() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("confirmed");
  const queryClient = useQueryClient();

  const { data: depositsData, isLoading } = useAdminListDeposits({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    page,
  });

  const confirmDeposit = useAdminConfirmDeposit();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [processingDeposit, setProcessingDeposit] = useState<any>(null);
  const [actionStatus, setActionStatus] = useState<ConfirmDepositInputStatus>("confirmed");
  const [txHash, setTxHash] = useState("");

  const openReview = (d: any) => {
    setProcessingId(d.id);
    setProcessingDeposit(d);
    setActionStatus("confirmed");
    setTxHash("");
  };

  const handleConfirm = () => {
    if (!processingId) return;
    confirmDeposit.mutate(
      { id: processingId, data: { status: actionStatus, transactionHash: txHash } },
      {
        onSuccess: () => {
          const label = actionStatus === "confirmed" ? "aprovado" : actionStatus === "failed" ? "recusado" : "cancelado";
          toast.success(`Depósito ${label} com sucesso`);
          if (actionStatus === "confirmed" && processingDeposit?.referrerName) {
            toast.info(`Bônus de indicação enviado para ${processingDeposit.referrerName}`);
          }
          setProcessingId(null);
          setProcessingDeposit(null);
          setTxHash("");
          queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao processar"),
      },
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending:   { label: "Pendente",   className: "border-amber-500/40 text-amber-400" },
      confirmed: { label: "Confirmado", className: "border-emerald-500/40 text-emerald-400" },
      failed:    { label: "Falhou",     className: "border-red-500/40 text-red-400" },
      cancelled: { label: "Cancelado",  className: "border-red-500/40 text-red-400" },
    };
    const cfg = map[status] ?? { label: status, className: "" };
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
  };

  const commissionBadge = (d: any) => {
    if (!d.referrerId) return <span className="text-muted-foreground text-xs">—</span>;
    if (d.commissionStatus === "paid")
      return <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">Processada</Badge>;
    return <Badge variant="outline" className="border-amber-500/40 text-amber-400">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Depósitos</h2>
          <p className="text-muted-foreground">Histórico de depósitos. Os pagamentos via gateway (NowPayments/Mercado Pago) são confirmados automaticamente por webhook.</p>
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente (manual)</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Automation banner */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-400">Confirmação automática ativa</p>
          <p className="text-xs text-muted-foreground mt-1">
            Depósitos via NowPayments (cripto) e Mercado Pago (PIX) são confirmados automaticamente
            quando o webhook do gateway notifica o pagamento. O saldo é creditado, a comissão de
            indicação é processada e o split de sócios é executado — tudo sem intervenção manual.
            A ação "Revisar" abaixo é apenas um fallback para casos excepcionais (ex.: webhook que falhou).
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Indicador</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(depositsData?.data as any[])?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {new Date(d.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{d.userName ?? `#${d.userId}`}</div>
                        {d.userEmail && <div className="text-xs text-muted-foreground">{d.userEmail}</div>}
                      </TableCell>
                      <TableCell className="font-medium">{METHOD_LABELS[d.method] ?? d.method}</TableCell>
                      <TableCell className="font-medium text-amber-400">{fmtBRL(Number(d.amount ?? 0))}</TableCell>
                      <TableCell>
                        {d.referrerName ? (
                          <div>
                            <div className="text-sm font-medium">{d.referrerName}</div>
                            {d.commissionRate !== null && (
                              <div className="text-xs text-muted-foreground">
                                {d.commissionRate}% ={" "}
                                <span className="text-emerald-400">
                                  {d.commissionAmount !== null ? fmtBRL(d.commissionAmount) : fmtBRL(Number(d.amount) * d.commissionRate / 100)}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sem indicador</span>
                        )}
                      </TableCell>
                      <TableCell>{commissionBadge(d)}</TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-right">
                        {d.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => openReview(d)}>
                            Confirmar (fallback)
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!depositsData?.data || depositsData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum depósito encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {depositsData && depositsData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <span className="text-sm text-muted-foreground">Página {page} de {depositsData.totalPages}</span>
                  <Button variant="outline" disabled={page === depositsData.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!processingId} onOpenChange={(open) => { if (!open) { setProcessingId(null); setProcessingDeposit(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Depósito #{processingId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {processingDeposit && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuário</span>
                  <span className="font-medium">{processingDeposit.userName ?? `#${processingDeposit.userId}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium text-amber-400">{fmtBRL(Number(processingDeposit.amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método</span>
                  <span>{METHOD_LABELS[processingDeposit.method] ?? processingDeposit.method}</span>
                </div>
                {processingDeposit.referrerName && (
                  <>
                    <div className="border-t border-border pt-2 mt-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Indicador</span>
                      <span className="font-medium">{processingDeposit.referrerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bônus ao aprovar</span>
                      <span className="font-medium text-emerald-400">
                        {processingDeposit.commissionRate}% = {fmtBRL(Number(processingDeposit.amount) * processingDeposit.commissionRate / 100)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Ação</label>
              <Select value={actionStatus} onValueChange={(val: any) => setActionStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Aprovar depósito</SelectItem>
                  <SelectItem value="failed">Recusar</SelectItem>
                  <SelectItem value="cancelled">Cancelar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionStatus === "confirmed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Hash da Transação (Opcional)</label>
                <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." className="font-mono text-sm" />
              </div>
            )}

            {actionStatus === "confirmed" && processingDeposit?.referrerName && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                <p className="text-emerald-400 font-medium">Bônus de indicação será creditado</p>
                <p className="text-muted-foreground mt-1">
                  {fmtBRL(Number(processingDeposit.amount) * processingDeposit.commissionRate / 100)} serão creditados automaticamente para{" "}
                  <span className="text-foreground font-medium">{processingDeposit.referrerName}</span>.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProcessingId(null); setProcessingDeposit(null); }}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmDeposit.isPending}
              variant={actionStatus === "confirmed" ? "default" : "destructive"}
            >
              {confirmDeposit.isPending ? "Processando..." : actionStatus === "confirmed" ? "Aprovar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
