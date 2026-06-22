import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetStrategy, useFetchStrategyPerformance, useBuyPosition, getGetStrategyQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const strategyId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: strategy, isLoading: isLoadingStrategy } = useGetStrategy(strategyId, {
    query: {
      enabled: !!strategyId,
      queryKey: getGetStrategyQueryKey(strategyId)
    }
  });

  const { data: performance, isLoading: isLoadingPerf } = useFetchStrategyPerformance(strategyId, {
    query: {
      enabled: !!strategyId,
    } as any,
  });

  const buyPositionMutation = useBuyPosition();
  const [amount, setAmount] = useState<string>("");

  if (isLoadingStrategy || isLoadingPerf) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="col-span-2 h-[400px]" />
          <Skeleton className="col-span-1 h-[400px]" />
        </div>
      </div>
    );
  }

  if (!strategy) {
    return <div>Strategy not found.</div>;
  }

  const handleBuy = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < strategy.minInvestment) {
      toast({ title: "Invalid amount", description: `Minimum investment is $${strategy.minInvestment}`, variant: "destructive" });
      return;
    }

    buyPositionMutation.mutate({ data: { strategyId, amount: parsedAmount } }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Position purchased successfully." });
        setAmount("");
        queryClient.invalidateQueries({ queryKey: getGetStrategyQueryKey(strategyId) });
        setLocation("/my-positions");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.data?.error || "Failed to purchase position.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{strategy.name}</h2>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="uppercase">{strategy.riskLevel} Risk</Badge>
            <Badge variant={strategy.status === "active" ? "default" : "secondary"}>{strategy.status}</Badge>
            <Badge variant="secondary">{strategy.category}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance History</CardTitle>
            </CardHeader>
            <CardContent>
              {performance && performance.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performance}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString()} />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(val) => new Date(val).toLocaleDateString()}
                        formatter={(val: number) => [`$${val.toFixed(2)}`, "Value"]}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No performance data available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About this Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{strategy.description}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invest</CardTitle>
              <CardDescription>Buy shares in this strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Share Price</span>
                <span className="font-semibold">${strategy.sharePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Min Investment</span>
                <span className="font-semibold">${strategy.minInvestment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Available Shares</span>
                <span className="font-semibold">{strategy.availableShares.toLocaleString()}</span>
              </div>
              
              <div className="pt-4 space-y-2">
                <label className="text-sm font-medium">Investment Amount ($)</label>
                <Input 
                  type="number" 
                  min={strategy.minInvestment} 
                  step="0.01" 
                  placeholder={`Min. ${strategy.minInvestment}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleBuy} 
                disabled={buyPositionMutation.isPending || !amount || parseFloat(amount) < strategy.minInvestment}
              >
                {buyPositionMutation.isPending ? "Processing..." : "Invest Now"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Total Return</span>
                <p className="text-xl font-semibold text-primary">+{strategy.totalReturnPct.toFixed(2)}%</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">AUM</span>
                <p className="text-xl font-semibold">${strategy.aum.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Start Date</span>
                <p className="text-xl font-semibold">{new Date(strategy.startDate).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
