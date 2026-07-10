import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { GeneralSettingsContent } from "./_settings-general";
import { PaymentGatewaysContent } from "./payment-gateways";
import { PartnersContent } from "./partners";

export default function AdminSettings() {
  const [location] = useLocation();
  // Suporta deep-link: /admin/settings?tab=gateways ou /admin/settings?tab=partners
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialTab = params.get("tab") === "gateways" ? "gateways" : params.get("tab") === "partners" ? "partners" : "geral";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Parâmetros globais, gateways de pagamento e sócios — tudo em um lugar.</p>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="gateways">Gateways & PIX</TabsTrigger>
          <TabsTrigger value="partners">Sócios & Split</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <GeneralSettingsContent embedded />
        </TabsContent>

        <TabsContent value="gateways" className="mt-6">
          <PaymentGatewaysContent embedded />
        </TabsContent>

        <TabsContent value="partners" className="mt-6">
          <PartnersContent embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
