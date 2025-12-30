import { useFinance } from "@/contexts/FinanceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FixedBillsList } from "./FixedBillsList";
import { Settings2, FastForward, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PotentialFixedBill, generateBillId } from "@/types/finance";

interface FixedBillSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "current" | "future";
  currentDate: Date;
}

export function FixedBillSelectorModal({ open, onOpenChange, mode, currentDate }: FixedBillSelectorModalProps) {
  const { 
    getPotentialFixedBillsForMonth, 
    getFutureFixedBills, 
    getBillsForMonth, 
    setBillsTracker 
  } = useFinance();

  const localBills = getBillsForMonth(currentDate);
  const potentialFixedBills = mode === "current" 
    ? getPotentialFixedBillsForMonth(currentDate, localBills)
    : getFutureFixedBills(currentDate, localBills);

  const onToggleFixedBill = (potential: PotentialFixedBill, isChecked: boolean) => {
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
      <DialogContent className="max-w-5xl p-0 overflow-hidden border-border/50 shadow-2xl rounded-3xl">
        <DialogHeader className={cn(
            "p-8 border-b bg-muted/30",
            isAdvance ? "text-primary" : "text-accent"
        )}>
          <div className="flex items-center gap-5">
            <div className={cn(
              "p-4 rounded-2xl backdrop-blur-sm shadow-sm border",
              isAdvance ? "bg-primary/10 border-primary/20" : "bg-accent/10 border-accent/20"
            )}>
              {isAdvance ? <FastForward className="w-8 h-8 text-primary" /> : <Settings2 className="w-8 h-8 text-accent" />}
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {isAdvance ? "Adiantar Parcelas" : "Gerenciar Contas Fixas"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-base mt-1">
                {isAdvance 
                  ? "Selecione parcelas de meses futuros para pagar agora e manter seu fluxo de caixa atualizado." 
                  : `Selecione quais parcelas de empréstimos, seguros ou compras devem aparecer em ${format(currentDate, 'MMMM', { locale: ptBR })}.`
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 max-h-[65vh] overflow-y-auto bg-background">
          {potentialFixedBills.length > 0 ? (
            <div className="space-y-6">
               <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground bg-muted/40 p-4 rounded-2xl border border-border/50">
                 <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                 <span>As parcelas selecionadas serão adicionadas à sua lista de controle mensal para facilitar o acompanhamento de pagamentos.</span>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 <FixedBillsList 
                    bills={potentialFixedBills} 
                    onToggleFixedBill={onToggleFixedBill}
                    mode={mode}
                 />
               </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-semibold text-foreground">Tudo em dia por aqui</h4>
                <p className="text-muted-foreground">Nenhuma parcela pendente encontrada para este período.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}