import { useQuery } from "@tanstack/react-query";
import { getSmartAccessToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeyRound, Copy } from "lucide-react";

interface ResetRow {
  userId: number;
  userName: string;
  userEmail: string;
  requestedAt: string;
  expiresAt: string;
  isExpired: boolean;
  resetLink: string;
}

export default function AdminPasswordResets() {
  const { data: resets, isLoading, refetch } = useQuery<ResetRow[]>({
    queryKey: ["admin", "password-resets"],
    queryFn: async () => {
      const token = await getSmartAccessToken();
      const res = await fetch("/api/admin/password-resets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar solicitações");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const copyLink = (link: string, email: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`Link copiado — envie para ${email}`);
  };

  const activeResets = resets?.filter(r => !r.isExpired) ?? [];
  const expiredResets = resets?.filter(r => r.isExpired) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Recuperação de Senha</h2>
        <p className="text-muted-foreground">
          Solicitações de redefinição de senha. Copie o link e envie ao usuário por outro canal (WhatsApp, e-mail, etc.).
        </p>
      </div>

      {/* Info box */}
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Como funciona</p>
            <p className="text-muted-foreground mt-1">
              Quando um usuário solicita redefinição de senha, o sistema gera um link seguro com validade de 1 hora.
              Como não há serviço de e-mail configurado, copie o link abaixo e entregue ao usuário pelo canal de atendimento da plataforma.
              O link expira após o uso ou decorrida 1 hora.
            </p>
          </div>
        </div>
      </div>

      {/* Active resets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Links Ativos
            {!isLoading && activeResets.length > 0 && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                {activeResets.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Links ainda válidos — copie e envie ao usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeResets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Nenhuma solicitação ativa.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeResets.map(r => (
                    <TableRow key={r.userId}>
                      <TableCell>
                        <div className="font-medium">{r.userName}</div>
                        <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(r.requestedAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-amber-400">
                          {new Date(r.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          ({new Date(r.expiresAt).toLocaleDateString("pt-BR")})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60"
                          onClick={() => copyLink(r.resetLink, r.userEmail)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar Link
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

      {/* Expired resets */}
      {!isLoading && expiredResets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-base">Histórico (Expirados)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Expirou em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredResets.map(r => (
                  <TableRow key={`${r.userId}-exp`} className="opacity-60">
                    <TableCell>
                      <div className="font-medium">{r.userName}</div>
                      <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.requestedAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.expiresAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-red-500/40 text-red-400">Expirado</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
