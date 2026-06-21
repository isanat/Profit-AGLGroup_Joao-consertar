import { useState } from "react";
import { useAdminListStrategies, useAdminCreateStrategy, useAdminUpdateStrategy, useAdminApplyYield, getAdminListStrategiesQueryKey } from "@workspace/api-client-react";
import { StrategyInputRiskLevel, StrategyInputStatus } from "@workspace/api-client-react/src/generated/api.schemas";
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
import { Textarea } from "@/components/ui/textarea";

export default function AdminStrategies() {
  const queryClient = useQueryClient();
  const { data: strategies, isLoading } = useAdminListStrategies();
  
  const createStrategy = useAdminCreateStrategy();
  const updateStrategy = useAdminUpdateStrategy();
  const applyYield = useAdminApplyYield();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [yieldId, setYieldId] = useState<number | null>(null);

  const [formData, setFormData] = useState<any>({});

  const handleCreate = () => {
    createStrategy.mutate({ data: formData as any }, {
      onSuccess: () => {
        toast.success("Strategy created");
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Creation failed")
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateStrategy.mutate({ id: editingId, data: formData }, {
      onSuccess: () => {
        toast.success("Strategy updated");
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Update failed")
    });
  };

  const handleApplyYield = () => {
    if (!yieldId) return;
    applyYield.mutate({ id: yieldId, data: formData }, {
      onSuccess: () => {
        toast.success("Yield applied successfully");
        setYieldId(null);
        queryClient.invalidateQueries({ queryKey: getAdminListStrategiesQueryKey() });
      },
      onError: (err) => toast.error(err.data?.error || "Apply yield failed")
    });
  };

  const openEdit = (strat: any) => {
    setFormData({ ...strat });
    setEditingId(strat.id);
  };

  const openYield = (strat: any) => {
    setFormData({ yieldPercentage: 0, description: `Yield for ${strat.name}` });
    setYieldId(strat.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manage Strategies</h2>
          <p className="text-muted-foreground">Create and update investment strategies.</p>
        </div>
        <Button onClick={() => { setFormData({ status: "active", riskLevel: "medium" }); setIsCreateOpen(true); }}>
          New Strategy
        </Button>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Share Price</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.id}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.category}</TableCell>
                    <TableCell>${s.sharePrice.toFixed(2)}</TableCell>
                    <TableCell>{s.availableShares} / {s.totalShares}</TableCell>
                    <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openYield(s)}>Apply Yield</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => { if(!open) { setIsCreateOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Strategy" : "New Strategy"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input value={formData.category || ""} onChange={e => setFormData({...formData, category: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Risk Level</label>
                <Select value={formData.riskLevel} onValueChange={v => setFormData({...formData, riskLevel: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Share Price</label>
                <Input type="number" step="0.01" value={formData.sharePrice || ""} onChange={e => setFormData({...formData, sharePrice: parseFloat(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Shares</label>
                <Input type="number" value={formData.totalShares || ""} onChange={e => setFormData({...formData, totalShares: parseInt(e.target.value, 10)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Investment</label>
                <Input type="number" step="0.01" value={formData.minInvestment || ""} onChange={e => setFormData({...formData, minInvestment: parseFloat(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingId(null); }}>Cancel</Button>
            <Button onClick={editingId ? handleUpdate : handleCreate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Yield Dialog */}
      <Dialog open={!!yieldId} onOpenChange={(open) => !open && setYieldId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Yield</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Yield Percentage (%)</label>
              <Input type="number" step="0.01" value={formData.yieldPercentage || ""} onChange={e => setFormData({...formData, yieldPercentage: parseFloat(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYieldId(null)}>Cancel</Button>
            <Button onClick={handleApplyYield}>Apply Yield</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
