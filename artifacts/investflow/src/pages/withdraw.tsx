import { useRequestWithdrawal, WithdrawalInputMethod } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { ArrowUpRight, Wallet, AlertTriangle } from "lucide-react";

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(10, "Valor mínimo é R$ 10,00"),
  method: z.enum(["pix", "usdt_bep20", "bitcoin", "usdc", "bnb"] as const),
  walletAddress: z.string().min(5, "Chave PIX ou endereço é obrigatório"),
});

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  usdt_bep20: "USDT (BEP20)",
  bitcoin: "Bitcoin",
  usdc: "USDC",
  bnb: "BNB",
};

export default function Withdraw() {
  const { user } = useAuth();
  const requestWithdrawal = useRequestWithdrawal();

  const form = useForm<z.infer<typeof withdrawalSchema>>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, method: "pix", walletAddress: "" },
  });

  const onSubmit = (data: z.infer<typeof withdrawalSchema>) => {
    requestWithdrawal.mutate(
      { data: { ...data, method: data.method as WithdrawalInputMethod } },
      {
        onSuccess: () => {
          toast.success("Saque solicitado! Aguarde a aprovação do administrador.");
          form.reset();
        },
        onError: (err: any) => {
          toast.error(err?.data?.error || "Erro ao solicitar saque");
        },
      },
    );
  };

  const balance = user?.balance ?? 0;

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sacar</h2>
        <p className="text-sm text-muted-foreground">Solicite um saque para sua conta ou carteira.</p>
      </div>

      {/* Balance card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f1e35 0%, #111827 100%)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Wallet style={{ width: "22px", height: "22px", color: "#f59e0b" }} />
        </div>
        <div>
          <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Saldo Disponível para Saque</p>
          <p style={{ fontSize: "28px", fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.02em" }}>
            {fmtBRL(balance)}
          </p>
        </div>
      </div>

      {/* Warning */}
      <div
        style={{
          background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: "12px",
          padding: "12px 14px",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}
      >
        <AlertTriangle style={{ width: "16px", height: "16px", color: "#f59e0b", flexShrink: 0, marginTop: "1px" }} />
        <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
          Saques passam por aprovação administrativa. O prazo de processamento pode variar.
        </p>
      </div>

      {/* Form */}
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Método de Saque
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione o método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="walletAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Chave PIX / Endereço da Carteira
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite a chave PIX ou endereço..."
                      className="h-12"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Valor (R$)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        style={{
                          position: "absolute",
                          left: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#64748b",
                          pointerEvents: "none",
                        }}
                      >
                        R$
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="10"
                        placeholder="0,00"
                        style={{ paddingLeft: "42px", fontSize: "16px", fontWeight: 700, height: "52px" }}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold"
              disabled={requestWithdrawal.isPending || balance <= 0}
              style={{
                background: "linear-gradient(135deg, #b45309, #f59e0b)",
                border: "none",
              }}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              {requestWithdrawal.isPending ? "Processando..." : "Solicitar Saque"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
