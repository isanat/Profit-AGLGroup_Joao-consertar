import { useState } from "react";
import { useAdminListWallets, useAdminCreateWallet, getAdminListWalletsQueryKey } from "@workspace/api-client-react";
import { WalletInputMethod } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminWallets() {
  const queryClient = useQueryClient();
  const { data: wallets, isLoading } = useAdminListWallets();
  const createWallet = useAdminCreateWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    method: "usdt_bep20" as WalletInputMethod,
    label: "",
    address: "",
    instructions: "",
    isActive: true
  });

  const handleCreate = () => {
    createWallet.mutate({ data: formData }, {
      onSuccess: () => {
        toast.success("Wallet added successfully");
        setIsOpen(false);
        setFormData({ method: "usdt_bep20", label: "", address: "", instructions: "", isActive: true });
        queryClient.invalidateQueries({ queryKey: getAdminListWalletsQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Failed to add wallet")
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Platform Wallets</h2>
          <p className="text-muted-foreground">Manage receiving addresses for deposits.</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>Add Wallet</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium uppercase">{w.method}</TableCell>
                    <TableCell>{w.label}</TableCell>
                    <TableCell className="font-mono text-sm">{w.address}</TableCell>
                    <TableCell>
                      <Badge variant={w.isActive ? "default" : "secondary"}>
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!wallets || wallets.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No wallets configured.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Wallet</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Method</label>
              <Select value={formData.method} onValueChange={(val: any) => setFormData({...formData, method: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="usdt_bep20">USDT (BEP20)</SelectItem>
                  <SelectItem value="bitcoin">Bitcoin</SelectItem>
                  <SelectItem value="usdc">USDC</SelectItem>
                  <SelectItem value="bnb">BNB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label (e.g. Main USDT Wallet)</label>
              <Input value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address / PIX Key</label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions</label>
              <Input value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} placeholder="Send only BEP20 tokens..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded border-gray-300" />
              <label htmlFor="isActive" className="text-sm font-medium">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createWallet.isPending || !formData.address || !formData.label}>
              {createWallet.isPending ? "Adding..." : "Add Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
