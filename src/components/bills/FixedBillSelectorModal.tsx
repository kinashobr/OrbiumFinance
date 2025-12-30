import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Settings, Plus } from "lucide-react";
import { PotentialFixedBill } from "@/types/finance";
import { FixedBillsList } from "./FixedBillsList";
import { cn } from "@/lib/utils";

interface FixedBillSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'current' | 'future';
  currentDate: Date;
  potentialFixedBills: PotentialFixedBill[];
  onToggleFixedBill: (bill: PotentialFixedBill, isChecked: boolean) => void;
}

export function FixedBillSelectorModal({
  open,
  onOpenChange,
  mode,
  potentialFixedBills,
  onToggleFixedBill,
}: FixedBillSelectorModalProps) {
  const isCurrent = mode === 'current';
  const Icon = isCurrent ? Settings : Plus;
  const colorClass = isCurrent ? "text-primary" : "text-accent";
  const bgClass = isCurrent ? "bg-primary/10" : "bg-accent/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70vw] p-0 overflow-hidden">
        <DialogHeader className={cn("px-6 pt-6 pb-4", bgClass)}>
          <div className="flex items-start gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgClass)}>
              <Icon className={cn("w-6 h-6", colorClass)} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {isCurrent ? "Gerenciar Contas Fixas" : "Adiantar Parcelas Futuras"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {isCurrent 
                  ? "Selecione as parcelas de empréstimos ou seguros para incluir neste mês" 
                  : "Selecione parcelas de meses futuros para pagar antecipadamente hoje"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <FixedBillsList
            bills={potentialFixedBills}
            onToggle={onToggleFixedBill}
            emptyMessage={isCurrent 
              ? "Nenhuma conta fixa pendente encontrada para este período." 
              : "Não há parcelas futuras disponíveis para adiantamento."}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}