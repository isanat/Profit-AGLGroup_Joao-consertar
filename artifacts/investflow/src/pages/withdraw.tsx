import { useRequestWithdrawal, WithdrawalInputMethod } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(10, "Minimum withdrawal is $10"),
  method: z.enum(["pix", "usdt_bep20", "bitcoin", "usdc", "bnb"] as const),
  walletAddress: z.string().min(5, "Address is required")
});

export default function Withdraw() {
  const { user } = useAuth();
  const requestWithdrawal = useRequestWithdrawal();

  const form = useForm<z.infer<typeof withdrawalSchema>>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, method: "pix", walletAddress: "" }
  });

  const onSubmit = (data: z.infer<typeof withdrawalSchema>) => {
    requestWithdrawal.mutate({ data }, {
      onSuccess: () => {
        toast.success("Withdrawal requested successfully");
        form.reset();
      },
      onError: (err) => {
        toast.error(err.data?.error || "Failed to request withdrawal");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Withdraw Funds</h2>
        <p className="text-muted-foreground">Request a withdrawal to your external wallet or account.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${user?.balance?.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Details</CardTitle>
          <CardDescription>Enter the details for your withdrawal request.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="usdt_bep20">USDT (BEP20)</SelectItem>
                        <SelectItem value="bitcoin">Bitcoin</SelectItem>
                        <SelectItem value="usdc">USDC</SelectItem>
                        <SelectItem value="bnb">BNB</SelectItem>
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
                    <FormLabel>Destination Address / PIX Key</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter address..." {...field} />
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
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={requestWithdrawal.isPending}>
                {requestWithdrawal.isPending ? "Processing..." : "Request Withdrawal"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
