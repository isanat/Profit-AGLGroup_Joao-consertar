import { useState } from "react";
import { useAdminListWithdrawals, useAdminApproveWithdrawal, getAdminListWithdrawalsQueryKey } from "@workspace/api-client-react";
import { ApproveWithdrawalInputAction } from "@workspace/api-client-react/src/generated/api.schemas";
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

export default function AdminWithdrawals() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const queryClient = useQueryClient();

  const { data: withdrawalsData, isLoading } = useAdminListWithdrawals({
    query: {
      status: statusFilter !== "all" ? statusFilter : undefined,
      page
    }
  });

  const approveWithdrawal = useAdminApproveWithdrawal();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<ApproveWithdrawalInputAction>("approve");
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");

  const handleProcess = () => {
    if (!processingId) return;
    approveWithdrawal.mutate({ 
      id: processingId, 
      data: { action: actionStatus, transactionHash: txHash, rejectionReason: reason } 
    }, {
      onSuccess: () => {
        toast.success(`Withdrawal ${actionStatus}d`);
        setProcessingId(null);
        setTxHash("");
        setReason("");
        queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Action failed")
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Withdrawals</h2>
          <p className="text-muted-foreground">Manage user withdrawal requests.</p>
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
                    <TableHead>Method & Address</TableHead>
                    <TableHead>Amount (Net)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawalsData?.data.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{w.userId}</TableCell>
                      <TableCell>
                        <div className="font-medium uppercase">{w.method}</div>
                        <div className="text-xs text-muted-foreground font-mono">{w.walletAddress}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${w.amount.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Net: ${w.netAmount.toFixed(2)} (Fee: ${w.fee.toFixed(2)})</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.status === "completed" || w.status === "approved" ? "default" : w.status === "pending" ? "outline" : "destructive"}>
                          {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {w.status === "pending" && (
                          <Button size="sm" onClick={() => { setProcessingId(w.id); setActionStatus("approve"); }}>Review</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {withdrawalsData?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No withdrawals found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {withdrawalsData && withdrawalsData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {withdrawalsData.totalPages}</span>
                  <Button variant="outline" disabled={page === withdrawalsData.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!processingId} onOpenChange={(open) => !open && setProcessingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Withdrawal #{processingId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={actionStatus} onValueChange={(val: any) => setActionStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approve / Complete</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionStatus === "approve" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Hash (Optional)</label>
                <Input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." />
              </div>
            )}
            {actionStatus === "reject" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason</label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Violation of terms..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingId(null)}>Cancel</Button>
            <Button onClick={handleProcess} disabled={approveWithdrawal.isPending} variant={actionStatus === "approve" ? "default" : "destructive"}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
