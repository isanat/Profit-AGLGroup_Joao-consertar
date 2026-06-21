import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Support() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground">We're here to help you.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Mail className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Email</h3>
            <p className="text-sm text-muted-foreground">support@investflow.com</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <MessageSquare className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Live Chat</h3>
            <p className="text-sm text-muted-foreground">Available 24/7</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Phone className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-1">Phone</h3>
            <p className="text-sm text-muted-foreground">+1 (800) 123-4567</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How long do withdrawals take?</AccordionTrigger>
              <AccordionContent>
                Crypto withdrawals are typically processed within 1-2 hours. PIX withdrawals are usually instant but can take up to 24 hours depending on the banking system.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>What are the minimum investment amounts?</AccordionTrigger>
              <AccordionContent>
                The minimum investment varies by strategy. You can see the specific minimum amount required on the strategy details page.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How are yields calculated and paid?</AccordionTrigger>
              <AccordionContent>
                Yields are calculated based on the performance of the underlying strategy. They are credited to your account balance automatically when the strategy manager distributes them.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is my money safe?</AccordionTrigger>
              <AccordionContent>
                We use industry-standard security measures, including cold storage for crypto assets and bank-level encryption. We highly recommend enabling 2FA on your account for additional security.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
