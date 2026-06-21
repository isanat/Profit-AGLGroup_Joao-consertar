import { useGetPositionsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MyPositions() {
  const { data: summary, isLoading } = useGetPositionsSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">My Positions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!summary) {
    return <div>No positions found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Positions</h2>
        <p className="text-muted-foreground">Manage your strategy investments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalInvested.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalCurrentValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalYield >= 0 ? "text-primary" : "text-destructive"}`}>
              {summary.totalYield >= 0 ? "+" : ""}${summary.totalYield.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{summary.totalYieldPercentage.toFixed(2)}% ROI</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strategy Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Invested</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>Yield</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byStrategy.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No active positions.
                  </TableCell>
                </TableRow>
              ) : (
                summary.byStrategy.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.strategyName}</TableCell>
                    <TableCell>{position.shares}</TableCell>
                    <TableCell>${position.investedAmount.toFixed(2)}</TableCell>
                    <TableCell>${position.currentValue.toFixed(2)}</TableCell>
                    <TableCell className={position.yieldAmount >= 0 ? "text-primary" : "text-destructive"}>
                      {position.yieldAmount >= 0 ? "+" : ""}${position.yieldAmount.toFixed(2)} ({position.yieldPercentage.toFixed(2)}%)
                    </TableCell>
                    <TableCell>
                      <Badge variant={position.status === "active" ? "default" : "secondary"}>
                        {position.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
