import { useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillsTrackerList } from "@/components/bills/BillsTrackerList";
import { FixedBillSelectorModal } from "@/components/bills/FixedBillSelectorModal";
import { AddPurchaseInstallmentDialog } from "@/components/bills/AddPurchaseInstallmentDialog";
import { Button } from "@/components/ui/button";
import { Settings2, FastForward, ShoppingCart, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BillsTracker() {
  const { 
    getBillsForMonth, 
    getOtherPaidExpensesForMonth,
    updateBill, 
    deleteBill, 
    setBillsTracker,
    billsTracker,
    transacoesV2 
  } = useFinance();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);

  const trackerBills = getBillsForMonth(currentDate);
  const externalPaidBills = getOtherPaidExpensesForMonth(currentDate);
  const allDisplayBills = [...trackerBills, ...externalPaidBills];

  const handleTogglePaid = (bill: any, isChecked: boolean) => {
    updateBill(bill.id, { isPaid: isChecked, paymentDate: isChecked ? format(new Date(), 'yyyy-MM-dd') : undefined });
  };

  return (
    <div className="container mx-auto p-4 space-y-6 animate-in fade-in duration-500">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/10 text-primary shadow-sm">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rastreador de Contas</h1>
            <p className="text-muted-foreground font-medium capitalize">
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Grupo de Botões de Ação Unificado */}
        <div className="flex flex-row items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
          <Button
            variant="outline"
            onClick={() => setIsPurchaseDialogOpen(true)}
            className="rounded-xl border-pink-200 bg-pink-50/40 text-pink-600 hover:bg-pink-100/60 gap-2 h-11 px-5 font-bold shadow-sm transition-all"
          >
            <ShoppingCart className="w-4.5 h-4.5" />
            <span>Parcelado</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsManageModalOpen(true)}
            className="rounded-xl border-border bg-card hover:bg-muted/50 gap-2 h-11 px-5 font-semibold shadow-sm transition-all"
          >
            <Settings2 className="w-4.5 h-4.5 text-muted-foreground" />
            <span>Gerenciar Fixas</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsAdvanceModalOpen(true)}
            className="rounded-xl border-border bg-card hover:bg-muted/50 gap-2 h-11 px-5 font-semibold shadow-sm transition-all"
          >
            <FastForward className="w-4.5 h-4.5 text-muted-foreground" />
            <span>Adiantar Parcelas</span>
          </Button>
        </div>
      </div>

      <BillsTrackerList
        bills={allDisplayBills}
        onUpdateBill={updateBill}
        onDeleteBill={deleteBill}
        onTogglePaid={handleTogglePaid}
        onAddBill={(bill) => {
            const newId = `bill_${Date.now()}`;
            setBillsTracker(prev => [...prev, { ...bill, id: newId, isPaid: false, type: 'tracker' }]);
        }}
        currentDate={currentDate}
      />

      <FixedBillSelectorModal
        open={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        mode="current"
        currentDate={currentDate}
      />

      <FixedBillSelectorModal
        open={isAdvanceModalOpen}
        onOpenChange={setIsAdvanceModalOpen}
        mode="future"
        currentDate={currentDate}
      />

      <AddPurchaseInstallmentDialog 
        open={isPurchaseDialogOpen}
        onOpenChange={setIsPurchaseDialogOpen}
        currentDate={currentDate}
      />
    </div>
  );
}