import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowRight, Calendar, Check, Clock, DollarSign, Repeat, Shield, TrendingDown } from "lucide-react";
import { PotentialFixedBill, BillSourceType, formatCurrency } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FutureInstallmentSelectorModal } from "./FutureInstallmentSelectorModal"; // Import NEW component

interface FixedInstallmentSelectorProps {
  potentialBills: PotentialFixedBill[];
  onToggleInstallment: (bill: PotentialFixedBill, isChecked: boolean) => void;
}

const SOURCE_CONFIG: Record<BillSourceType, { icon: React.ElementType; color: string; label: string }> = {
  loan_installment: { icon: DollarSign, color: 'text-orange-500', label: 'Empréstimo' },
  insurance_installment: { icon: Shield, color: 'text-blue-500', label: 'Seguro' },
  fixed_expense: { icon: Repeat, color: 'text-purple-500', label: 'Fixa' },
  variable_expense: { icon: TrendingDown, color: 'text-warning', label: 'Variável' },
  ad_hoc: { icon: Calendar, color: 'text-primary', label: 'Avulsa' },
};

export function FixedInstallmentSelector({
  potentialBills,
  onToggleInstallment,
}: FixedInstallmentSelectorProps) {
  
  const [showFutureModal, setShowFutureModal] = useState(false);

  const pendingBills = useMemo(() => 
    potentialBills.filter(b => !b.isPaid),
    [potentialBills]
  );
  
  const totalPendingAmount = useMemo(() => 
    pendingBills.filter(b => !b.isIncluded).reduce((acc, b) => acc + b.expectedAmount, 0),
    [pendingBills]
  );
  
  const totalIncludedAmount = useMemo(() => 
    pendingBills.filter(b => b.isIncluded).reduce((acc, b) => acc + b.expectedAmount, 0),
    [pendingBills]
  );

  const handleIncludeFutureBills = (bills: PotentialFixedBill[]) => {
    bills.forEach(bill => {
        // Simula o toggle para incluir a conta na lista principal (localBills)
        onToggleInstallment(bill, true);
    });
  };

  return (
    <Card className="p-3 space-y-3 glass-card shrink-0">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
          <Clock className="w-4 h-4 text-destructive" />
          Parcelas Fixas do Mês ({pendingBills.length})
        </Label>
        
        <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs px-2 gap-1"
            onClick={() => setShowFutureModal(true)}
        >
            <Calendar className="w-3 h-3" />
            Adiantar Parcelas
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableBody>
            {pendingBills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-xs">
                  <Check className="w-4 h-4 mx-auto mb-1 text-success" />
                  Nenhuma parcela fixa pendente neste mês.
                </TableCell>
              </TableRow>
            ) : (
              pendingBills.map((bill) => {
                const config = SOURCE_CONFIG[bill.sourceType] || SOURCE_CONFIG.ad_hoc;
                const Icon = config.icon;
                
                return (
                  <TableRow key={bill.key} className={cn("h-10", bill.isIncluded && "bg-primary/5 hover:bg-primary/10")}>
                    <TableCell className="w-[40px] text-center p-2">
                      <Checkbox
                        checked={bill.isIncluded}
                        onCheckedChange={(checked) => onToggleInstallment(bill, checked as boolean)}
                        className={cn("w-4 h-4", bill.isIncluded && "border-primary data-[state=checked]:bg-primary")}
                      />
                    </TableCell>
                    <TableCell className="text-xs p-2">
                      <div className="flex items-center gap-1">
                        <Icon className={cn("w-3 h-3", config.color)} />
                        <span className="font-medium">{bill.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[100px] text-right font-semibold text-xs p-2">
                      {formatCurrency(bill.expectedAmount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground pt-1">
        <span>Incluídas: <span className="font-semibold text-primary">{formatCurrency(totalIncludedAmount)}</span></span>
        <span>Pendentes: <span className="font-semibold text-destructive">{formatCurrency(totalPendingAmount)}</span></span>
      </div>
      
      {/* Modal de Adiantamento */}
      <FutureInstallmentSelectorModal
        open={showFutureModal}
        onOpenChange={setShowFutureModal}
        localBills={potentialBills} // Passamos as bills do mês para que o modal saiba o que já está incluído
        onIncludeBills={handleIncludeFutureBills}
      />
    </Card>
  );
}