import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Link } from "wouter";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const verifyEmail = useVerifyEmail();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Missing verification token");
      return;
    }

    verifyEmail.mutate({ data: { token } }, {
      onSuccess: () => {
        setStatus("success");
      },
      onError: (err: any) => {
        setStatus("error");
        setErrorMsg(err.data?.error || "Verification failed");
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Alliance Group" className="h-24 w-auto mx-auto mb-2" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Alliance Group</h1>
        </div>

        <Card className="text-center">
          <CardHeader>
            <CardTitle>Email Verification</CardTitle>
            <CardDescription>We are verifying your email address</CardDescription>
          </CardHeader>
          <CardContent className="py-8 flex flex-col items-center">
            {status === "verifying" && (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p>Please wait while we verify your email...</p>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-12 w-12 text-primary mb-4" />
                <p className="font-medium text-lg">Email Verified Successfully!</p>
                <p className="text-muted-foreground mt-2">Your account is now fully active.</p>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="font-medium text-lg text-destructive">Verification Failed</p>
                <p className="text-muted-foreground mt-2">{errorMsg}</p>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border pt-4">
            <Link href="/dashboard" className="w-full">
              <Button className="w-full" variant={status === "success" ? "default" : "outline"}>
                Continue to Dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
