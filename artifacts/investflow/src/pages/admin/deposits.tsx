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

export default function AdminDeposits() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const queryClient = useQueryClient();

  const { data: depositsData, isLoading } = useAdminListDeposits({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    page,
  });

  const confirmDeposit = useAdminConfirmDeposit();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<ConfirmDepositInputStatus>("confirmed");
  const [txHash, setTxHash] = useState("");

  const handleConfirm = () => {
    if (!processingId) return;
    confirmDeposit.mutate(
      { id: processingId, data: { status: actionStatus, transactionHash: txHash } },
      {
        onSuccess: () => {
          toast.success(`Depósito ${actionStatus === "confirmed" ? "confirmado" : "recusado"}`);
          setProcessingId(null);
          setTxHash("");
          queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao processar"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Depósitos</h2>
          <p className="text-muted-foreground">Gerencie solicitações de depósito dos usuários.</p>
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
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
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositsData?.data?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">{new Date(d.createdAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{d.userId}</TableCell>
                      <TableCell className="uppercase">{d.method}</TableCell>
                      <TableCell className="font-medium">R$ {Number(d.amount ?? 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "confirmed" ? "default" : d.status === "pending" ? "outline" : "destructive"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {d.status === "pending" && (
                          <Button size="sm" onClick={() => { setProcessingId(d.id); setActionStatus("confirmed"); }}>
                            Revisar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!depositsData?.data || depositsData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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

      <Dialog open={!!processingId} onOpenChange={(open) => !open && setProcessingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Depósito #{processingId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ação</label>
              <Select value={actionStatus} onValueChange={(val: any) => setActionStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmar</SelectItem>
                  <SelectItem value="failed">Marcar como Falhou</SelectItem>
                  <SelectItem value="cancelled">Cancelar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionStatus === "confirmed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Hash da Transação (Opcional)</label>
                <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingId(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmDeposit.isPending}
              variant={actionStatus === "confirmed" ? "default" : "destructive"}
            >
              {confirmDeposit.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
