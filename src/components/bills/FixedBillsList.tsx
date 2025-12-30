import React from "react";
import { 
  Building2 as Building, 
  Shield as Security, 
  Repeat as Recurrent, 
  DollarSign as Money, 
  Info as Help, 
  ShoppingCart as Purchase, 
  Plus as Add, 
  Trash2 as Remove, 
  Calendar as DateIcon 
} from "lucide-react";
import { BillSourceType, PotentialFixedBill, formatCurrency } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { cn, parseDateLocal } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FixedBillsListProps {
  bills: PotentialFixedBill[];
  onToggleFixedBill: (bill: PotentialFixedBill, isChecked: boolean) => void;
  mode?: "current" | "future";
}

const SOURCE_CONFIG: Record<BillSourceType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  loan_installment: { icon: Building, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Empréstimo' },
  insurance_installment: { icon: Security, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Seguro' },
  fixed_expense: { icon: Recurrent, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Fixa' },
  variable_expense: { icon: Money, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Variável' },
  ad_hoc: { icon: Help, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Avulsa' },
  purchase_installment: { icon: Purchase, color: 'text-pink-500', bgColor: 'bg-pink-500/10', label: 'Parcela' },
};

export function FixedBillsList({ bills, onToggleFixedBill, mode = "current" }: FixedBillsListProps) {
  return (
    <div className="flex flex-col gap-3">
      {bills.map((bill) => {
        const config = SOURCE_CONFIG[bill.sourceType as BillSourceType];
        const Icon = config.icon;
        const dueDate = parseDateLocal(bill.dueDate);

        return (
          <div 
            key={bill.key}
            className={cn(
              "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
              bill.isIncluded 
                ? "bg-primary/5 border-primary/20 shadow-sm" 
                : "bg-card border-border hover:border-primary/30"
            )}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                config.bgColor
              )}>
                <Icon className={cn("w-6 h-6", config.color)} />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base truncate">{bill.description}</span>
                  {bill.isPaid && (
                    <span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">Paga</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <DateIcon className="w-3.5 h-3.5" />
                    {format(dueDate, "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="font-bold text-foreground/80">{formatCurrency(bill.expectedAmount)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant={bill.isIncluded ? "ghost" : "outline"}
                size="sm"
                onClick={() => onToggleFixedBill(bill, !bill.isIncluded)}
                className={cn(
                  "h-10 px-4 rounded-xl gap-2 font-semibold shrink-0",
                  bill.isIncluded 
                    ? "text-destructive hover:bg-destructive/10" 
                    : "border-primary/40 text-primary hover:bg-primary hover:text-white"
                )}
              >
                {bill.isIncluded ? (
                  <Remove className="w-4 h-4" />
                ) : (
                  <Add className="w-4 h-4" />
                )}
                <span>
                  {bill.isIncluded ? "Remover" : "Incluir na lista"}
                </span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}