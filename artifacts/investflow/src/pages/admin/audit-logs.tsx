import { useState } from "react";
import { useGetAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState("");

  const { data: logsData, isLoading } = useGetAuditLogs({
    query: {
      userId: userIdFilter ? parseInt(userIdFilter) : undefined,
      page,
      limit: 20
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">System-wide activity tracker.</p>
        </div>
        <div className="w-[200px]">
          <Input 
            placeholder="Filter by User ID" 
            value={userIdFilter} 
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }} 
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData?.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{log.userEmail || log.userId || "System"}</TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>{log.entityType} {log.entityId ? `#${log.entityId}` : ""}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {logsData?.data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {logsData && logsData.totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {logsData.totalPages}</span>
                  <Button variant="outline" disabled={page === logsData.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
