import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Phone, Send } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteConfig } from "@/lib/site-config";

export default function Support() {
  const { config } = useSiteConfig();

  const cards = [];
  if (config?.supportWhatsapp) {
    const waNumber = config.supportWhatsapp.replace(/\D/g, "");
    cards.push({
      icon: <MessageSquare className="h-8 w-8 text-emerald-400 mb-4" />,
      title: "WhatsApp",
      value: config.supportWhatsapp,
      link: `https://wa.me/${waNumber}`,
      linkText: "Conversar agora",
    });
  }
  if (config?.supportEmail) {
    cards.push({
      icon: <Mail className="h-8 w-8 text-amber-400 mb-4" />,
      title: "E-mail",
      value: config.supportEmail,
      link: `mailto:${config.supportEmail}`,
      linkText: "Enviar e-mail",
    });
  }
  if (config?.supportPhone) {
    cards.push({
      icon: <Phone className="h-8 w-8 text-blue-400 mb-4" />,
      title: "Telefone",
      value: config.supportPhone,
      link: `tel:${config.supportPhone.replace(/\D/g, "")}`,
      linkText: "Ligar agora",
    });
  }
  if (config?.supportTelegram) {
    cards.push({
      icon: <Send className="h-8 w-8 text-sky-400 mb-4" />,
      title: "Telegram",
      value: config.supportTelegram,
      link: `https://t.me/${config.supportTelegram.replace("@", "")}`,
      linkText: "Abrir Telegram",
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Suporte</h2>
        <p className="text-sm text-muted-foreground">Estamos aqui para ajudar você.</p>
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum canal de suporte configurado ainda. O administrador pode configurar em Configurações → Geral.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c, i) => (
            <Card key={i}>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                {c.icon}
                <h3 className="font-semibold mb-1">{c.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{c.value}</p>
                <a
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {c.linkText} →
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Quanto tempo levam os saques?</AccordionTrigger>
              <AccordionContent>
                Saques em cripto são processados em 1-2 horas. Saques via PIX são geralmente instantâneos, mas podem levar até 24h.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Quais os valores mínimos de investimento?</AccordionTrigger>
              <AccordionContent>
                Cada estratégia tem seu valor mínimo, começando a partir de R$ 100. Verifique a página de Planos para detalhes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Como funciona o rendimento diário?</AccordionTrigger>
              <AccordionContent>
                O rendimento é creditado automaticamente 24h após a ativação de cada posição, baseado no percentual da estratégia.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Como funciona o programa de indicações?</AccordionTrigger>
              <AccordionContent>
                Você recebe 5% de bônus sobre cada depósito confirmado dos seus indicados diretos. Compartilhe seu link na página de Indicações.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
