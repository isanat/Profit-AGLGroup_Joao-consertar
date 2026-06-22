import { useGetDepositMethods, useCreateDeposit, DepositInputMethod } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Deposit() {
  const { data: methods, isLoading } = useGetDepositMethods();
  const createDepositMutation = useCreateDeposit();
  const { toast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [depositResult, setDepositResult] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full max-w-2xl" />
      </div>
    );
  }

  const activeMethods = methods?.filter(m => m.isActive) || [];

  const handleDeposit = () => {
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) return;
    
    createDepositMutation.mutate({
      data: { method: selectedMethod as DepositInputMethod, amount: parseFloat(amount) }
    }, {
      onSuccess: (res) => {
        setDepositResult(res);
        toast({ title: "Deposit initiated", description: "Please follow the instructions to complete the payment." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.data?.error || "Failed to initiate deposit", variant: "destructive" });
      }
    });
  };

  const selectedMethodDetails = activeMethods.find(m => m.method === selectedMethod);

  if (depositResult) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight">Deposit Instructions</h2>
        <Card>
          <CardHeader>
            <CardTitle>Complete your Deposit</CardTitle>
            <CardDescription>Status: <Badge variant="secondary" className="uppercase">{depositResult.status}</Badge></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted rounded-md text-center">
              <p className="text-sm text-muted-foreground mb-1">Amount to send</p>
              <p className="text-3xl font-bold">${depositResult.amount.toFixed(2)}</p>
            </div>
            
            {depositResult.walletAddress && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Wallet Address</p>
                <div className="flex gap-2">
                  <Input value={depositResult.walletAddress} readOnly />
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(depositResult.walletAddress);
                    toast({ title: "Copied", description: "Address copied to clipboard" });
                  }}>Copy</Button>
                </div>
              </div>
            )}
            
            {depositResult.qrCodeUrl && (
              <div className="flex justify-center">
                <img src={depositResult.qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-md bg-white p-2" />
              </div>
            )}

            <Button className="w-full" variant="outline" onClick={() => setDepositResult(null)}>
              Make another deposit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Deposit Funds</h2>
        <p className="text-muted-foreground">Add funds to your account balance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {activeMethods.map((method) => (
          <Card 
            key={method.method} 
            className={`cursor-pointer transition-colors ${selectedMethod === method.method ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
            onClick={() => setSelectedMethod(method.method)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
              <h3 className="font-semibold text-lg">{method.label}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{method.instructions}</p>
              <span className="text-xs font-medium text-primary mt-2 block">Min: ${method.minAmount.toFixed(2)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedMethod && (
        <Card className="mt-8 border-primary/20">
          <CardHeader>
            <CardTitle>Amount</CardTitle>
            <CardDescription>Enter the amount you wish to deposit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                min={selectedMethodDetails?.minAmount}
              />
              <p className="text-xs text-muted-foreground">
                Minimum deposit for {selectedMethodDetails?.label} is ${selectedMethodDetails?.minAmount.toFixed(2)}.
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleDeposit}
              disabled={!amount || parseFloat(amount) < (selectedMethodDetails?.minAmount || 0) || createDepositMutation.isPending}
            >
              {createDepositMutation.isPending ? "Processing..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
