import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useModal } from "@/lib/modal-context";
import { DepositContent } from "@/pages/deposit";
import { WithdrawContent } from "@/pages/withdraw";
import { NotificationsContent } from "@/pages/notifications";
import { Wallet, ArrowLeftRight, Bell } from "lucide-react";

export function GlobalModals() {
  const { activeModal, closeModal } = useModal();

  return (
    <>
      {/* Deposit modal */}
      <Dialog open={activeModal === "deposit"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-400" /> Depositar
            </DialogTitle>
            <DialogDescription className="sr-only">Modal de depósito</DialogDescription>
          </DialogHeader>
          <DepositContent />
        </DialogContent>
      </Dialog>

      {/* Withdraw modal */}
      <Dialog open={activeModal === "withdraw"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-emerald-400" /> Sacar
            </DialogTitle>
            <DialogDescription className="sr-only">Modal de saque</DialogDescription>
          </DialogHeader>
          <WithdrawContent />
        </DialogContent>
      </Dialog>

      {/* Notifications modal */}
      <Dialog open={activeModal === "notifications"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-400" /> Notificações
            </DialogTitle>
            <DialogDescription className="sr-only">Modal de notificações</DialogDescription>
          </DialogHeader>
          <NotificationsContent />
        </DialogContent>
      </Dialog>
    </>
  );
}
