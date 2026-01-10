import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Check, Building2, Shield, ShoppingCart, Calendar, X } from "lucide-react";
import { PotentialFixedBill, formatCurrency } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,52rem)] h-[min(90vh,800px)] p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl flex flex-col">
        <DialogHeader className={cn(
          "px-8 pt-10 pb-6 shrink-0",
          isCurrent ? "bg-primary/5" : "bg-accent/5"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={cn(
                "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg",
                isCurrent ? "bg-primary/10 text-primary shadow-primary/5" : "bg-accent/10 text-accent shadow-accent/5"
              )}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tighter">
                  {isCurrent ? "Gerenciar Fixas" : "Adiantar Parcelas"}
                </DialogTitle>
                <DialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {isCurrent ? "Provisionamento do Mês" : "Pagamento Antecipado"}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" onClick={() => onOpenChange(false)}>
              <X className="w-6 h-6" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-8">
          {potentialFixedBills.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
              <Calendar className="w-16 h-16 mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">Nenhuma parcela encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {potentialFixedBills.map((bill) => {
                const isLoan = bill.sourceType === 'loan_installment';
                const isInsurance = bill.sourceType === 'insurance_installment';
                const isPurchase = bill.sourceType === 'purchase_installment';
                
                return (
                  <button
                    key={bill.key}
                    onClick={() => onToggleFixedBill(bill, !bill.isIncluded)}
                    className={cn(
                      "p-5 rounded-[2rem] border-2 text-left transition-all group relative overflow-hidden",
                      bill.isIncluded 
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/5 scale-[1.02]" 
                        : "bg-card border-border/40 hover:border-primary/30 hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                        bill.isIncluded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {isLoan ? <Building2 className="w-6 h-6" /> :
                         isInsurance ? <Shield className="w-6 h-6" /> :
                         <ShoppingCart className="w-6 h-6" />}
                      </div>
                      {bill.isIncluded && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground animate-in zoom-in duration-300">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="font-black text-sm text-foreground leading-tight truncate">
                        {bill.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <Calendar className="w-3 h-3" />
                        {format(parseDateLocal(bill.dueDate), "dd 'de' MMMM", { locale: ptBR })}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/20 flex items-end justify-between">
                      <div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Valor</p>
                        <p className={cn(
                          "text-lg font-black",
                          bill.isIncluded ? "text-primary" : "text-foreground"
                        )}>
                          {formatCurrency(bill.expectedAmount)}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-lg border-none bg-muted/50 text-[9px] font-black px-2 py-0.5">
                        P{bill.parcelaNumber}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-8 bg-surface-light dark:bg-surface-dark border-t shrink-0">
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full h-14 rounded-[1.5rem] font-black text-base shadow-xl shadow-primary/10"
          >
            CONCLUIR SELEÇÃO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}