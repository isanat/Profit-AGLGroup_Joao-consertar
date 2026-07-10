import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const resetPassword = useResetPassword();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      toast.error("Link de redefinição inválido ou ausente.");
      setLocation("/login");
    }
  }, [token, setLocation]);

  const onSubmit = (data: z.infer<typeof schema>) => {
    resetPassword.mutate({ data }, {
      onSuccess: () => {
        toast.success("Senha redefinida com sucesso! Faça login com a nova senha.");
        setLocation("/login");
      },
      onError: (err: any) => {
        toast.error(err.data?.error || "Link inválido ou expirado.");
      },
    });
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Alliance Group" className="h-24 w-auto mx-auto mb-2" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Alliance Group</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Senha</CardTitle>
            <CardDescription>
              Escolha uma nova senha para sua conta. O link expira em 1 hora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
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
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? "Redefinindo..." : "Redefinir Senha"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border pt-4">
            <Link href="/login" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
