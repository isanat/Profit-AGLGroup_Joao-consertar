import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSmartAccessToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, TrendingUp, UserCheck, RefreshCw } from "lucide-react";

interface ReferralRow {
  referralId: number;
  referrerId: number;
  referrerName: string;
  referrerEmail: string;
  referredId: number;
  referredName: string;
  referredEmail: string;
  referredStatus: string;
  totalCommissionPaid: number;
  joinedAt: string;
  createdAt: string;
}

interface SummaryStats {
  totalReferrals: number;
  totalCommissionPaid: number;
  topReferrers: { name: string; count: number }[];
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminReferrals() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ referrals: ReferralRow[]; stats: SummaryStats }>({
    queryKey: ["admin", "referrals"],
    queryFn: async () => {
      const token = await getSmartAccessToken();
      const res = await fetch("/api/admin/referrals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar indicações");
      return res.json();
    },
  });

  const replayMutation = useMutation({
    mutationFn: async (referredId: number) => {
      const token = await getSmartAccessToken();
      const res = await fetch("/api/admin/commissions/replay", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: referredId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao reparar comissão");
      return data;
    },
    onSuccess: (data) => {
      if (data.credited?.length > 0) {
        toast.success(`${data.credited.length} comissão(ões) creditada(s) para ${data.referrerName} — R$ ${data.credited.reduce((a: number, c: any) => a + c.amount, 0).toFixed(2)}`);
      } else {
        toast.info("Nenhuma comissão pendente encontrada para este indicado.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "referrals"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao reparar comissão");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Indicações</h2>
        <p className="text-muted-foreground">Monitoramento de todos os vínculos de indicação da plataforma.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : (data?.stats.totalReferrals ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total em Comissões</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {isLoading ? <Skeleton className="h-8 w-24" /> : fmtBRL(data?.stats.totalCommissionPaid ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Maiores Indicadores</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : data?.stats.topReferrers.length ? (
              <div className="space-y-1">
                {data.stats.topReferrers.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-foreground truncate">{r.name}</span>
                    <span className="text-muted-foreground ml-2">{r.count} ind.</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum ainda</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referrals table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Vínculos</CardTitle>
          <CardDescription>Indicador → Indicado, com comissões geradas e status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Status do Indicado</TableHead>
                  <TableHead>Comissão Paga</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.referrals.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum vínculo de indicação encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.referrals.map(r => (
                    <TableRow key={r.referralId}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.referrerName}</div>
                        <div className="text-xs text-muted-foreground">{r.referrerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{r.referredName}</div>
                        <div className="text-xs text-muted-foreground">{r.referredEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={r.referredStatus === "active"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-amber-500/40 text-amber-400"}
                        >
                          {r.referredStatus === "active" ? "Ativo" : r.referredStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className={r.totalCommissionPaid > 0 ? "text-amber-400 font-medium" : "text-muted-foreground"}>
                        {r.totalCommissionPaid > 0 ? fmtBRL(r.totalCommissionPaid) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(r.joinedAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          disabled={replayMutation.isPending}
                          onClick={() => replayMutation.mutate(r.referredId)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reparar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
