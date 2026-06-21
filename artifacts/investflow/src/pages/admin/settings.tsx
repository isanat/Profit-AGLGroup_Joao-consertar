import { useEffect, useState } from "react";
import { useGetAdminSettings, useUpdateAdminSettings, getGetAdminSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const handleSave = () => {
    updateSettings.mutate({ data: formData }, {
      onSuccess: () => {
        toast.success("Settings updated successfully");
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      },
      onError: (err) => {
        toast.error(err.data?.error || "Failed to update settings");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Platform Settings</h2>
        <p className="text-muted-foreground">Configure global application parameters.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Adjust fees, limits, and system toggles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Withdrawal Fee (%)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={formData.withdrawalFeePercent ?? 0} 
                onChange={e => setFormData({...formData, withdrawalFeePercent: parseFloat(e.target.value)})} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Referral Commission (%)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={formData.referralCommissionPercent ?? 0} 
                onChange={e => setFormData({...formData, referralCommissionPercent: parseFloat(e.target.value)})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Deposit ($)</label>
              <Input 
                type="number" 
                value={formData.minDeposit ?? 0} 
                onChange={e => setFormData({...formData, minDeposit: parseFloat(e.target.value)})} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Withdrawal ($)</label>
              <Input 
                type="number" 
                value={formData.minWithdrawal ?? 0} 
                onChange={e => setFormData({...formData, minWithdrawal: parseFloat(e.target.value)})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Withdrawal ($)</label>
              <Input 
                type="number" 
                value={formData.maxWithdrawal ?? 0} 
                onChange={e => setFormData({...formData, maxWithdrawal: parseFloat(e.target.value)})} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Referral Levels</label>
              <Input 
                type="number" 
                value={formData.referralLevels ?? 0} 
                onChange={e => setFormData({...formData, referralLevels: parseInt(e.target.value)})} 
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-medium text-sm">System Toggles</h3>
            
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">Disable user access to the platform</p>
              </div>
              <input 
                type="checkbox" 
                checked={formData.maintenanceMode || false} 
                onChange={e => setFormData({...formData, maintenanceMode: e.target.checked})}
                className="w-5 h-5 rounded border-gray-300" 
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Deposits Enabled</p>
                <p className="text-sm text-muted-foreground">Allow users to create deposits</p>
              </div>
              <input 
                type="checkbox" 
                checked={formData.depositEnabled ?? true} 
                onChange={e => setFormData({...formData, depositEnabled: e.target.checked})}
                className="w-5 h-5 rounded border-gray-300" 
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Withdrawals Enabled</p>
                <p className="text-sm text-muted-foreground">Allow users to request withdrawals</p>
              </div>
              <input 
                type="checkbox" 
                checked={formData.withdrawalEnabled ?? true} 
                onChange={e => setFormData({...formData, withdrawalEnabled: e.target.checked})}
                className="w-5 h-5 rounded border-gray-300" 
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
