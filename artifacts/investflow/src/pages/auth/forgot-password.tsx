import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, ArrowLeft } from "lucide-react";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const forgotPassword = useForgotPassword();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    forgotPassword.mutate({ data }, {
      onSuccess: () => {
        setSubmittedEmail(data.email);
        setSent(true);
      },
      onError: (err: any) => {
        // Show generic error, try again
        setSent(true); // Still show success state for security
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Alliance Group" className="h-24 w-auto mx-auto mb-2" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Alliance Group</h1>
        </div>

        <Card>
          {!sent ? (
            <>
              <CardHeader>
                <CardTitle>Recuperar Senha</CardTitle>
                <CardDescription>
                  Digite seu e-mail cadastrado. O link de redefinição será gerado pelo administrador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                      {forgotPassword.isPending ? "Processando..." : "Solicitar Redefinição"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex justify-center mb-3">
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                </div>
                <CardTitle className="text-center">Solicitação Recebida</CardTitle>
                <CardDescription className="text-center">
                  Se o e-mail <span className="text-foreground font-medium">{submittedEmail}</span> estiver cadastrado,
                  o link de redefinição foi registrado pelo sistema. Entre em contato com o suporte para receber seu link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  O link de redefinição expira em 1 hora após a solicitação.
                </p>
              </CardContent>
            </>
          )}
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
