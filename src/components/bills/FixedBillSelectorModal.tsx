import { useFinance } from "@/contexts/FinanceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FixedBillsList } from "./FixedBillsList";
import { Settings2, FastForward, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PotentialFixedBill, generateBillId } from "@/types/finance";
import { Button } from "@/components/ui/button";

interface FixedBillSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "current" | "future";
  currentDate: Date;
  potentialFixedBills?: PotentialFixedBill[];
  onToggleFixedBill?: (potential: PotentialFixedBill, isChecked: boolean) => void;
}

export function FixedBillSelectorModal({ 
  open, 
  onOpenChange, 
  mode, 
  currentDate,
  potentialFixedBills: externalBills,
  onToggleFixedBill: externalToggle
}: FixedBillSelectorModalProps) {
  const { 
    getPotentialFixedBillsForMonth, 
    getFutureFixedBills, 
    getBillsForMonth, 
    setBillsTracker 
  } = useFinance();

  const localBills = getBillsForMonth(currentDate);
  
  const potentialFixedBills = externalBills || (mode === "current" 
    ? getPotentialFixedBillsForMonth(currentDate, localBills)
    : getFutureFixedBills(currentDate, localBills));

  const handleToggleFixedBill = (potential: PotentialFixedBill, isChecked: boolean) => {
    if (externalToggle) {
      externalToggle(potential, isChecked);
      return;
    }

    if (isChecked) {
      setBillsTracker(prev => [
        ...prev,
        {
          id: generateBillId(),
          type: 'tracker',
          description: potential.description,
          dueDate: potential.dueDate,
          expectedAmount: potential.expectedAmount,
          isPaid: potential.isPaid,
          sourceType: potential.sourceType,
          sourceRef: potential.sourceRef,
          parcelaNumber: potential.parcelaNumber,
          isExcluded: false,
        }
      ]);
    } else {
      setBillsTracker(prev => prev.filter(b => 
        !(b.sourceType === potential.sourceType && 
          b.sourceRef === potential.sourceRef && 
          b.parcelaNumber === potential.parcelaNumber)
      ));
    }
  };

  const isAdvance = mode === "future";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[75vw] p-0 overflow-hidden border-border shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={cn(
                "p-4 rounded-2xl shadow-sm",
                isAdvance ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
              )}>
                {isAdvance ? <FastForward className="w-7 h-7" /> : <Settings2 className="w-7 h-7" />}
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                  {isAdvance ? "Adiantar Parcelas" : "Gerenciar Contas Fixas"}
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {isAdvance 
                    ? "Antecipe pagamentos de meses futuros na sua lista atual" 
                    : `Parcelas automáticas disponíveis para ${format(currentDate, 'MMMM', { locale: ptBR })}`
                  }
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-10 w-10">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-8 max-h-[75vh] overflow-y-auto bg-muted/5">
          {potentialFixedBills.length > 0 ? (
            <div className="space-y-8">
               <div className="flex items-center gap-3 text-sm font-medium text-primary bg-primary/5 p-4 rounded-2xl border border-primary/10">
                 <AlertCircle className="w-5 h-5" />
                 <span>As parcelas que você selecionar serão exibidas no rastreador de contas deste mês.</span>
               </div>
               <FixedBillsList 
                  bills={potentialFixedBills} 
                  onToggleFixedBill={handleToggleFixedBill}
                  mode={mode}
               />
            </div>
          ) : (
            <div className="py-24 text-center space-y-5">
              <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground/30" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-foreground/70">Nenhuma parcela pendente</p>
                <p className="text-muted-foreground max-w-sm mx-auto">Todas as parcelas fixas previstas para este período já foram incluídas ou não existem no momento.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}