import { useState } from "react";
import {
  useAdminListWithdrawals,
  useAdminApproveWithdrawal,
  getAdminListWithdrawalsQueryKey,
  type ApproveWithdrawalInputAction,
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

export default function AdminWithdrawals() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const queryClient = useQueryClient();

  const { data: withdrawalsData, isLoading } = useAdminListWithdrawals({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    page,
  });

  const approveWithdrawal = useAdminApproveWithdrawal();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<ApproveWithdrawalInputAction>("approve");
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");

  const handleProcess = () => {
    if (!processingId) return;
    approveWithdrawal.mutate(
      {
        id: processingId,
        data: { action: actionStatus, transactionHash: txHash, rejectionReason: reason },
      },
      {
        onSuccess: () => {
          toast.success(`Saque ${actionStatus === "approve" ? "aprovado" : "recusado"}`);
          setProcessingId(null);
          setTxHash("");
          setReason("");
          queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao processar"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Saques</h2>
          <p className="text-muted-foreground">Solicitações de saque. Saques de baixo valor são aprovados automaticamente (configurável).</p>
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="rejected">Recusado</SelectItem>
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
          <p className="text-sm font-semibold text-emerald-400">Aprovação automática (configurável)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Um cron verifica a cada 10 minutos os saques pendentes. Saques abaixo do limite configurado
            (em Configurações) de usuários ativos com conta antiga são aprovados automaticamente.
            Saques acima do limite ou de contas novas aparecem aqui para revisão manual.
            Você pode ativar/desativar e ajustar o limite em <strong>Configurações</strong>.
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
                    <TableHead>Usuário ID</TableHead>
                    <TableHead>Método e Endereço</TableHead>
                    <TableHead>Valor (Líquido)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawalsData?.data?.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="whitespace-nowrap">{new Date(w.createdAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{w.userId}</TableCell>
                      <TableCell>
                        <div className="font-medium uppercase">{w.method}</div>
                        <div className="text-xs text-muted-foreground font-mono">{w.walletAddress}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">R$ {Number(w.amount ?? 0).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">
                          Líq: R$ {Number(w.netAmount ?? 0).toFixed(2)} (Taxa: R$ {Number(w.fee ?? 0).toFixed(2)})
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.status === "completed" || w.status === "approved" ? "default" : w.status === "pending" ? "outline" : "destructive"}>
                          {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {w.status === "pending" && (
                          <Button size="sm" onClick={() => { setProcessingId(w.id); setActionStatus("approve"); }}>
                            Revisar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!withdrawalsData?.data || withdrawalsData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum saque encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {withdrawalsData && withdrawalsData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <span className="text-sm text-muted-foreground">Página {page} de {withdrawalsData.totalPages}</span>
                  <Button variant="outline" disabled={page === withdrawalsData.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!processingId} onOpenChange={(open) => !open && setProcessingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Saque #{processingId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ação</label>
              <Select value={actionStatus} onValueChange={(val: any) => setActionStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Aprovar / Concluir</SelectItem>
                  <SelectItem value="reject">Recusar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionStatus === "approve" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Hash da Transação (Opcional)</label>
                <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." />
              </div>
            )}
            {actionStatus === "reject" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo da Recusa</label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Violação dos termos..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingId(null)}>Cancelar</Button>
            <Button
              onClick={handleProcess}
              disabled={approveWithdrawal.isPending}
              variant={actionStatus === "approve" ? "default" : "destructive"}
            >
              {approveWithdrawal.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
