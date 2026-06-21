import { useListStrategies } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { TrendingUp, ShieldAlert, BarChart3 } from "lucide-react";

export default function Strategies() {
  const { data: strategies, isLoading } = useListStrategies();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Investment Strategies</h2>
          <p className="text-muted-foreground">Discover and invest in curated portfolios.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[280px] w-full" />)}
        </div>
      </div>
    );
  }

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case "low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "high": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Investment Strategies</h2>
        <p className="text-muted-foreground">Discover and invest in curated portfolios managed by our experts.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {strategies?.map((strategy) => (
          <Card key={strategy.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={getRiskColor(strategy.riskLevel)}>
                  {strategy.riskLevel.toUpperCase()} RISK
                </Badge>
                <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                  {strategy.status}
                </Badge>
              </div>
              <CardTitle className="text-xl">{strategy.name}</CardTitle>
              <CardDescription className="line-clamp-2">{strategy.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3"/> Total Return</p>
                  <p className="font-semibold text-primary">+{strategy.totalReturnPct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1"><BarChart3 className="h-3 w-3"/> Monthly Avg</p>
                  <p className="font-semibold">+{strategy.monthlyReturnPct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 flex items-center gap-1"><ShieldAlert className="h-3 w-3"/> Max Drawdown</p>
                  <p className="font-semibold text-destructive">-{strategy.maxDrawdown.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Share Price</p>
                  <p className="font-semibold">${strategy.sharePrice.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border">
              <Link href={`/strategies/${strategy.id}`} className="w-full">
                <Button className="w-full" variant="default">View Details & Invest</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
        {strategies?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No strategies currently available.
          </div>
        )}
      </div>
    </div>
  );
}
