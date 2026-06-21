import { useState } from "react";
import { useAdminListDeposits, useAdminConfirmDeposit, getAdminListDepositsQueryKey } from "@workspace/api-client-react";
import { ConfirmDepositInputStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    query: {
      status: statusFilter !== "all" ? statusFilter : undefined,
      page
    }
  });

  const confirmDeposit = useAdminConfirmDeposit();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<ConfirmDepositInputStatus>("confirmed");
  const [txHash, setTxHash] = useState("");

  const handleConfirm = () => {
    if (!processingId) return;
    confirmDeposit.mutate({ id: processingId, data: { status: actionStatus, transactionHash: txHash } }, {
      onSuccess: () => {
        toast.success(`Deposit ${actionStatus}`);
        setProcessingId(null);
        setTxHash("");
        queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Action failed")
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Deposits</h2>
          <p className="text-muted-foreground">Manage user deposit requests.</p>
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositsData?.data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{d.userId}</TableCell>
                      <TableCell className="uppercase">{d.method}</TableCell>
                      <TableCell className="font-medium">${d.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "confirmed" ? "default" : d.status === "pending" ? "outline" : "destructive"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {d.status === "pending" && (
                          <Button size="sm" onClick={() => { setProcessingId(d.id); setActionStatus("confirmed"); }}>Review</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {depositsData?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No deposits found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {depositsData && depositsData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {depositsData.totalPages}</span>
                  <Button variant="outline" disabled={page === depositsData.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!processingId} onOpenChange={(open) => !open && setProcessingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Deposit #{processingId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={actionStatus} onValueChange={(val: any) => setActionStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirm</SelectItem>
                  <SelectItem value="failed">Mark as Failed</SelectItem>
                  <SelectItem value="cancelled">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionStatus === "confirmed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Hash (Optional)</label>
                <Input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingId(null)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={confirmDeposit.isPending} variant={actionStatus === "confirmed" ? "default" : "destructive"}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
