import { useGetReferralInfo, useListCommissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Link as LinkIcon, DollarSign, TrendingUp, Award, History } from "lucide-react";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Referrals() {
  const { data: info, isLoading } = useGetReferralInfo();
  const { data: commissions, isLoading: commissionsLoading } = useListCommissions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!info) return <div className="p-4 text-muted-foreground">Erro ao carregar dados de indicações.</div>;

  const copyLink = () => {
    navigator.clipboard.writeText(info.referralLink);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Programa de Indicações</h2>
        <p className="text-muted-foreground">
          Indique amigos e receba {info.commissionRate}% de bônus sobre cada depósito aprovado.
        </p>
      </div>

      {/* Referral link */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-emerald-400" />
            Seu Link de Indicação
          </CardTitle>
          <CardDescription>
            Compartilhe este link. O bônus é creditado automaticamente quando o depósito do indicado for aprovado pelo administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={info.referralLink} readOnly className="bg-background font-mono text-sm" />
            <Button onClick={copyLink} className="shrink-0">
              <LinkIcon className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Código de indicação: <span className="font-mono text-emerald-400 font-medium">{info.referralCode}</span>
          </p>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{info.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">{info.activeReferrals} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido em Bônus</CardTitle>
            <Award className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{fmtBRL(info.totalCommissionEarned)}</div>
            <p className="text-xs text-muted-foreground">Comissões pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Comissão</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{info.commissionRate}%</div>
            <p className="text-xs text-muted-foreground">Sobre depósitos aprovados</p>
          </CardContent>
        </Card>
      </div>

      {/* Network table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Sua Rede de Indicados
          </CardTitle>
          <CardDescription>
            Bônus gerado = {info.commissionRate}% do valor de cada depósito aprovado do indicado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead>Total Investido</TableHead>
                <TableHead className="text-right">Bônus Gerado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {info.referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum indicado ainda. Compartilhe seu link para começar!
                  </TableCell>
                </TableRow>
              ) : (
                (info.referrals as any[]).map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-medium">{ref.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ref.joinedAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{fmtBRL(ref.totalInvested)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-400">
                      {ref.commissionGenerated > 0
                        ? `+${fmtBRL(ref.commissionGenerated)}`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Commission history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de Bônus
          </CardTitle>
          <CardDescription>
            Todas as comissões recebidas, vinculadas a depósitos aprovados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Depósito ref.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!commissions || (commissions as any[]).length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum bônus recebido ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  (commissions as any[]).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{c.fromUserName}</TableCell>
                      <TableCell>
                        <span className="text-emerald-400">{c.rate}%</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.depositId ? `#${c.depositId}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={c.status === "paid"
                            ? "text-emerald-400 border-emerald-500/30"
                            : "text-amber-400 border-amber-500/30"}
                        >
                          {c.status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-400">
                        +{fmtBRL(c.amount)}
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
