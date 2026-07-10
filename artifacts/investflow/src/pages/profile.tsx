import { useAuth } from "@/lib/auth";
import { useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bitcoin, Wallet, CreditCard } from "lucide-react";
import { SecurityContent } from "@/pages/security";

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  country: z.string().optional(),
  btcWallet: z.string().optional(),
  usdtWallet: z.string().optional(),
  usdcWallet: z.string().optional(),
  pixKeyType: z.string().optional(),
  pixKey: z.string().optional(),
  pixBankName: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user } = useAuth();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      country: "",
      btcWallet: "",
      usdtWallet: "",
      usdcWallet: "",
      pixKeyType: "",
      pixKey: "",
      pixBankName: "",
    },
  });

  const pixKeyType = watch("pixKeyType");

  useEffect(() => {
    if (user) {
      reset({
        name: user.name ?? "",
        phone: user.phone ?? "",
        country: user.country ?? "",
        btcWallet: (user as any).btcWallet ?? "",
        usdtWallet: (user as any).usdtWallet ?? "",
        usdcWallet: (user as any).usdcWallet ?? "",
        pixKeyType: (user as any).pixKeyType ?? "",
        pixKey: (user as any).pixKey ?? "",
        pixBankName: (user as any).pixBankName ?? "",
      });
    }
  }, [user, reset]);

  const onSubmit = (data: ProfileForm) => {
    const payload: Record<string, string | null> = {
      name: data.name,
      phone: data.phone || null,
      country: data.country || null,
      btcWallet: data.btcWallet || null,
      usdtWallet: data.usdtWallet || null,
      usdcWallet: data.usdcWallet || null,
      pixKeyType: data.pixKeyType || null,
      pixKey: data.pixKey || null,
      pixBankName: data.pixBankName || null,
    };

    updateMe.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          toast.success("Perfil atualizado com sucesso");
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err: any) => {
          toast.error(err?.data?.error || "Erro ao atualizar perfil");
        },
      },
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Meu Perfil</h2>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais, dados de pagamento e segurança.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="perfil">Dados</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Seus dados de cadastro e contato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" {...register("phone")} placeholder="+55 11 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input id="country" {...register("country")} placeholder="Brasil" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crypto Wallets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-amber-500" />
              Carteiras Cripto
            </CardTitle>
            <CardDescription>
              Endereços utilizados para depósitos e saques em criptomoedas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="btcWallet">
                Carteira Bitcoin (BTC)
              </Label>
              <Input
                id="btcWallet"
                {...register("btcWallet")}
                placeholder="Endereço Bitcoin (ex: bc1q...)"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usdtWallet">
                Carteira USDT (BEP20)
              </Label>
              <Input
                id="usdtWallet"
                {...register("usdtWallet")}
                placeholder="Endereço BEP20 (ex: 0x...)"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usdcWallet">
                Carteira USDC
              </Label>
              <Input
                id="usdcWallet"
                {...register("usdcWallet")}
                placeholder="Endereço USDC (ex: 0x...)"
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* PIX Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Configuração PIX
            </CardTitle>
            <CardDescription>
              Chave PIX utilizada para recebimento de saques.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Chave PIX</Label>
              <Controller
                name="pixKeyType"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de chave" />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {pixKeyType && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pixKey">
                    Chave PIX{" "}
                    <span className="text-muted-foreground text-xs">
                      ({PIX_KEY_TYPES.find((t) => t.value === pixKeyType)?.label})
                    </span>
                  </Label>
                  <Input
                    id="pixKey"
                    {...register("pixKey")}
                    placeholder={
                      pixKeyType === "cpf"
                        ? "000.000.000-00"
                        : pixKeyType === "cnpj"
                          ? "00.000.000/0001-00"
                          : pixKeyType === "email"
                            ? "seu@email.com"
                            : pixKeyType === "phone"
                              ? "+55 11 99999-9999"
                              : "Chave aleatória"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pixBankName">Nome do Banco</Label>
                  <Input
                    id="pixBankName"
                    {...register("pixBankName")}
                    placeholder="Ex: Nubank, Itaú, Bradesco..."
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={updateMe.isPending} className="w-full sm:w-auto">
          {updateMe.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </form>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6">
          <SecurityContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
