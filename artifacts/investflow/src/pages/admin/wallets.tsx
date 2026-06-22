import { useState } from "react";
import {
  useAdminListWallets,
  useAdminCreateWallet,
  getAdminListWalletsQueryKey,
  type WalletInputMethod,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSmartAccessToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  usdt_bep20: "USDT BEP20",
  bitcoin: "BITCOIN",
  usdc: "USDC",
  bnb: "BNB",
};

const BLANK_FORM = {
  method: "usdt_bep20" as WalletInputMethod,
  label: "",
  address: "",
  instructions: "",
  isActive: true,
};

interface Wallet {
  id: number;
  method: string;
  label: string;
  address: string;
  instructions?: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminWallets() {
  const queryClient = useQueryClient();
  const { data: wallets, isLoading } = useAdminListWallets();
  const createWallet = useAdminCreateWallet();

  const [createOpen, setCreateOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [deleteWallet, setDeleteWallet] = useState<Wallet | null>(null);
  const [formData, setFormData] = useState({ ...BLANK_FORM });
  const [editForm, setEditForm] = useState({ ...BLANK_FORM });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListWalletsQueryKey() });

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getSmartAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na operação");
    return data;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<typeof BLANK_FORM> }) =>
      authFetch(`/api/admin/wallets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { toast.success("Carteira atualizada"); setEditWallet(null); invalidate(); },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar carteira"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/admin/wallets/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Carteira removida"); setDeleteWallet(null); invalidate(); },
    onError: (err: any) => toast.error(err.message || "Erro ao remover carteira"),
  });

  const handleCreate = () => {
    if (!formData.label.trim() || !formData.address.trim()) {
      toast.error("Label e endereço são obrigatórios");
      return;
    }
    createWallet.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("Carteira adicionada com sucesso");
          setCreateOpen(false);
          setFormData({ ...BLANK_FORM });
          invalidate();
        },
        onError: (err: any) => toast.error(err?.data?.error || err?.message || "Erro ao adicionar carteira"),
      },
    );
  };

  const openEdit = (w: Wallet) => {
    setEditWallet(w);
    setEditForm({
      method: w.method as WalletInputMethod,
      label: w.label,
      address: w.address,
      instructions: w.instructions ?? "",
      isActive: w.isActive,
    });
  };

  const handleEdit = () => {
    if (!editWallet) return;
    if (!editForm.label.trim() || !editForm.address.trim()) {
      toast.error("Label e endereço são obrigatórios");
      return;
    }
    updateMutation.mutate({ id: editWallet.id, body: editForm });
  };

  const handleToggle = (w: Wallet) => {
    updateMutation.mutate(
      { id: w.id, body: { isActive: !w.isActive } },
      { onSuccess: () => toast.success(w.isActive ? "Carteira desativada" : "Carteira ativada") },
    );
  };

  const WalletForm = ({
    form,
    setForm,
  }: {
    form: typeof BLANK_FORM;
    setForm: (f: typeof BLANK_FORM) => void;
  }) => (
    <div className="grid gap-4 py-4">
      <div className="space-y-2">
        <Label>Método</Label>
        <Select value={form.method} onValueChange={(val: any) => setForm({ ...form, method: val })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="usdt_bep20">USDT (BEP20)</SelectItem>
            <SelectItem value="bitcoin">Bitcoin</SelectItem>
            <SelectItem value="usdc">USDC</SelectItem>
            <SelectItem value="bnb">BNB</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Label (ex: Carteira USDT Principal)</Label>
        <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Endereço / Chave PIX</Label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Instruções (opcional)</Label>
        <Input
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="Envie apenas tokens BEP20..."
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="form-active"
          checked={form.isActive}
          onCheckedChange={(v) => setForm({ ...form, isActive: v })}
        />
        <Label htmlFor="form-active">Carteira ativa</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Carteiras da Plataforma</h2>
          <p className="text-muted-foreground">Gerencie endereços de recebimento para depósitos.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Adicionar Carteira</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium uppercase">{METHOD_LABELS[w.method] ?? w.method}</TableCell>
                    <TableCell>{w.label}</TableCell>
                    <TableCell className="font-mono text-sm max-w-[280px] truncate">{w.address}</TableCell>
                    <TableCell>
                      <Badge
                        variant={w.isActive ? "default" : "secondary"}
                        className={w.isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-600 bg-slate-800 text-slate-400"}
                      >
                        {w.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={w.isActive ? "Desativar" : "Ativar"}
                          disabled={updateMutation.isPending}
                          onClick={() => handleToggle(w as Wallet)}
                        >
                          {w.isActive
                            ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                            : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                          title="Editar"
                          onClick={() => openEdit(w as Wallet)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          title="Remover"
                          onClick={() => setDeleteWallet(w as Wallet)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!wallets || wallets.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma carteira configurada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Carteira</DialogTitle>
          </DialogHeader>
          <WalletForm form={formData} setForm={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={createWallet.isPending || !formData.address || !formData.label}
            >
              {createWallet.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editWallet} onOpenChange={(v) => !v && setEditWallet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Carteira</DialogTitle>
          </DialogHeader>
          <WalletForm form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWallet(null)}>Cancelar</Button>
            <Button
              onClick={handleEdit}
              disabled={updateMutation.isPending || !editForm.address || !editForm.label}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteWallet} onOpenChange={(v) => !v && setDeleteWallet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Carteira</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a carteira <strong>{deleteWallet?.label}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWallet(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteWallet && deleteMutation.mutate(deleteWallet.id)}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
