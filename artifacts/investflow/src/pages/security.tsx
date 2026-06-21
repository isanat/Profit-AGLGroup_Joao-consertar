import { useChangePassword, useEnable2fa, useVerify2fa } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export default function Security() {
  const { user } = useAuth();
  const changePwd = useChangePassword();
  const enable2fa = useEnable2fa();
  const verify2fa = useVerify2fa();
  
  const [twoFactorSetup, setTwoFactorSetup] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const pwdForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });

  const onPwdSubmit = (data: z.infer<typeof passwordSchema>) => {
    changePwd.mutate({ data }, {
      onSuccess: () => {
        toast.success("Password updated successfully");
        pwdForm.reset();
      },
      onError: (err) => {
        toast.error(err.data?.error || "Failed to update password");
      }
    });
  };

  const handleEnable2FA = () => {
    enable2fa.mutate(undefined, {
      onSuccess: (data) => {
        setTwoFactorSetup(data);
      },
      onError: (err) => {
        toast.error(err.data?.error || "Failed to setup 2FA");
      }
    });
  };

  const handleVerify2FA = () => {
    verify2fa.mutate({ data: { code: verifyCode } }, {
      onSuccess: () => {
        toast.success("2FA enabled successfully!");
        setTwoFactorSetup(null);
        window.location.reload(); // Quick refresh to update user context
      },
      onError: (err) => {
        toast.error(err.data?.error || "Invalid code");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Security</h2>
        <p className="text-muted-foreground">Protect your account and assets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...pwdForm}>
            <form onSubmit={pwdForm.handleSubmit(onPwdSubmit)} className="space-y-4">
              <FormField
                control={pwdForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pwdForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pwdForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePwd.isPending}>
                {changePwd.isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.twoFactorEnabled ? (
            <div className="flex items-center gap-4 p-4 border border-primary/20 bg-primary/5 rounded-md">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-primary">2FA is Enabled</p>
                <p className="text-sm text-muted-foreground">Your account is secured with authenticator app.</p>
              </div>
            </div>
          ) : twoFactorSetup ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">1. Scan this QR code with Google Authenticator or Authy</p>
              <div className="bg-white p-2 inline-block rounded-md">
                <img src={twoFactorSetup.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              <p className="text-sm font-mono bg-muted p-2 rounded">{twoFactorSetup.secret}</p>
              
              <div className="space-y-2 mt-4">
                <p className="text-sm text-muted-foreground">2. Enter the 6-digit code from the app</p>
                <div className="flex gap-2 max-w-xs">
                  <Input placeholder="000000" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} maxLength={6} />
                  <Button onClick={handleVerify2FA} disabled={verify2fa.isPending || verifyCode.length < 6}>
                    Verify
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-semibold mb-2 text-destructive">Save these backup codes!</p>
                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                  {twoFactorSetup.backupCodes.map((code: string, i: number) => (
                    <div key={i}>{code}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/5 rounded-md">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">2FA is Disabled</p>
                  <p className="text-sm text-muted-foreground">We highly recommend enabling 2FA.</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleEnable2FA} disabled={enable2fa.isPending}>
                Setup 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
