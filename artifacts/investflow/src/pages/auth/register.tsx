import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, UserCheck } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  country: z.string().optional(),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof registerSchema>;

interface ReferrerInfo {
  name: string;
  code: string;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const registerMutation = useRegister();

  // Read referral code from URL query string
  const [refFromUrl] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [referrerError, setReferrerError] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "", email: "", password: "", confirmPassword: "",
      phone: "", country: "", referralCode: refFromUrl,
    },
  });

  const validateReferralCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferrerInfo(null);
      setReferrerError("");
      return;
    }
    setIsValidatingCode(true);
    try {
      const res = await fetch(`/api/auth/validate-referral?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (data.valid) {
        setReferrerInfo({ name: data.referrerName, code: data.referralCode });
        setReferrerError("");
        form.setValue("referralCode", data.referralCode);
      } else {
        setReferrerInfo(null);
        setReferrerError(data.error || "Código de indicação inválido.");
      }
    } catch {
      setReferrerInfo(null);
      setReferrerError("Erro ao validar código. Tente novamente.");
    } finally {
      setIsValidatingCode(false);
    }
  }, [form]);

  // Validate code from URL on mount
  useEffect(() => {
    if (refFromUrl) {
      validateReferralCode(refFromUrl);
    }
  }, [refFromUrl, validateReferralCode]);

  const onSubmit = (data: FormData) => {
    const code = data.referralCode?.trim();
    // If user provided a code but it's invalid, block submission
    if (code && !referrerInfo) {
      toast.error(referrerError || "Valide o código de indicação antes de continuar.");
      return;
    }
    registerMutation.mutate({ data: { ...data, referralCode: code || undefined } }, {
      onSuccess: (res) => {
        login(res.accessToken, res.refreshToken);
        toast.success("Conta criada com sucesso!");
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast.error(err.data?.error || "Erro ao criar conta.");
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Alliance Group" className="h-24 w-auto mx-auto mb-2" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Alliance Group</h1>
          <p className="text-muted-foreground mt-2">Crie sua conta de investimentos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
            <CardDescription>Preencha seus dados para começar</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Referrer display when coming from a valid referral link */}
            {referrerInfo && (
              <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3">
                <UserCheck className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-emerald-400 font-medium">Indicado por</p>
                  <p className="text-foreground font-semibold">{referrerInfo.name}</p>
                  <p className="text-muted-foreground text-xs">Código: {referrerInfo.code}</p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="nome@exemplo.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+55 11 9..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>País (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="BR" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Referral code field */}
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Indicação {!refFromUrl && "(Opcional)"}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="Ex: ADMIN001"
                            {...field}
                            readOnly={!!refFromUrl && !!referrerInfo}
                            className={refFromUrl && referrerInfo ? "bg-muted/30 pr-9" : "pr-9"}
                            onChange={(e) => {
                              field.onChange(e);
                              if (!refFromUrl) {
                                // Debounce manual validation
                                clearTimeout((window as any).__refTimeout);
                                (window as any).__refTimeout = setTimeout(() => {
                                  validateReferralCode(e.target.value);
                                }, 600);
                              }
                            }}
                          />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {isValidatingCode && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {!isValidatingCode && referrerInfo && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                            {!isValidatingCode && referrerError && field.value && <XCircle className="h-4 w-4 text-destructive" />}
                          </div>
                        </div>
                      </FormControl>
                      {referrerError && field.value && (
                        <p className="text-xs text-destructive">{referrerError}</p>
                      )}
                      {!referrerError && referrerInfo && (
                        <p className="text-xs text-emerald-400">Indicador: {referrerInfo.name}</p>
                      )}
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={registerMutation.isPending || isValidatingCode}>
                  {registerMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
                  ) : "Criar Conta"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
