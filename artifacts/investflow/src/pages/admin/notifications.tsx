import { useState } from "react";
import {
  useAdminBroadcastNotification,
  type BroadcastNotificationInputType,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminNotifications() {
  const broadcast = useAdminBroadcastNotification();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BroadcastNotificationInputType>("info");
  const [targetIds, setTargetIds] = useState("");

  const handleBroadcast = () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    const ids = targetIds
      ? targetIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))
      : null;

    broadcast.mutate(
      {
        data: {
          title,
          message,
          type,
          targetUserIds: ids && ids.length > 0 ? ids : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Notificação enviada com sucesso");
          setTitle("");
          setMessage("");
          setTargetIds("");
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao enviar notificação"),
      },
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Notificações</h2>
        <p className="text-muted-foreground">Envie mensagens do sistema para os usuários.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Mensagem</CardTitle>
          <CardDescription>Envie uma notificação para todos os usuários ou IDs específicos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Atualização do sistema" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Estamos atualizando nossos sistemas..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informação</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">IDs dos Usuários (Opcional)</label>
              <Input
                value={targetIds}
                onChange={(e) => setTargetIds(e.target.value)}
                placeholder="1, 2, 5 (vazio = todos)"
              />
            </div>
          </div>

          <Button
            onClick={handleBroadcast}
            disabled={broadcast.isPending || !title.trim() || !message.trim()}
            className="w-full mt-4"
          >
            {broadcast.isPending ? "Enviando..." : "Enviar Notificação"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
