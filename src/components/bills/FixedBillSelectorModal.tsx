import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Repeat, Settings, X, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PotentialFixedBill } from "@/types/finance";
import { FixedBillsList } from "./FixedBillsList";
import { ResizableDialogContent } from "../ui/ResizableDialogContent";

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
  currentDate,
  potentialFixedBills,
  onToggleFixedBill,
}: FixedBillSelectorModalProps) {
  
  const title = mode === 'current' 
    ? `Gerenciar Parcelas Fixas do Mês (${format(currentDate, 'MMMM yyyy', { locale: ptBR })})`
    : `Próximos Vencimentos Fixos (Após ${format(currentDate, 'MMMM yyyy', { locale: ptBR })})`;
    
  const description = mode === 'current'
    ? "Selecione as parcelas de empréstimos e seguros que devem ser incluídas na lista de Contas a Pagar deste mês."
    : "Selecione parcelas futuras para adiantar o pagamento e incluí-las na lista de Contas a Pagar do mês atual.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent 
        storageKey={`fixed_bill_selector_modal_${mode}`}
        initialWidth={1000}
        initialHeight={600}
        minWidth={600}
        minHeight={400}
        hideCloseButton={true}
        className="bg-card border-border overflow-hidden flex flex-col"
      >
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {mode === 'current' ? <Repeat className="w-5 h-5 text-primary" /> : <Settings className="w-5 h-5 text-primary" />}
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden p-6 pt-0 flex flex-col">
          <FixedBillsList 
            bills={potentialFixedBills}
            onToggleFixedBill={onToggleFixedBill}
            mode={mode}
          />
          
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </ResizableDialogContent>
    </Dialog>
  );
}