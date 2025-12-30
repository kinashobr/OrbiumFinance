import { useState, useMemo, useCallback } from "react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillsTrackerList } from "@/components/bills/BillsTrackerList";
import { BillsSidebarKPIs } from "@/components/bills/BillsSidebarKPIs";
import { FixedBillSelectorModal } from "@/components/bills/FixedBillSelectorModal";
import { AddPurchaseInstallmentDialog } from "@/components/bills/AddPurchaseInstallmentDialog";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, ShoppingCart, Settings, ArrowLeftRight, CreditCard, Shield } from "lucide-react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BillTracker, PotentialFixedBill, BillDisplayItem, generateBillId } from "@/types/finance";
import { toast } from "sonner";

export default function BillsTrackerPage() {
  const { 
    getBillsForMonth, 
    getPotentialFixedBillsForMonth,
    getFutureFixedBills,
    getOtherPaidExpensesForMonth,
    updateBill,
    deleteBill,
    setBillsTracker,
    contasMovimento,
    markSeguroParcelPaid,
    markLoanParcelPaid
  } = useFinance();

  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const trackerManagedBills = useMemo(() => getBillsForMonth(currentDate), [getBillsForMonth, currentDate]);
  const externalPaidBills = useMemo(() => getOtherPaidExpensesForMonth(currentDate), [getOtherPaidExpensesForMonth, currentDate]);
  
  const combinedBills: BillDisplayItem[] = useMemo(() => {
    return [...trackerManagedBills, ...externalPaidBills];
  }, [trackerManagedBills, externalPaidBills]);

  const potentialFixedBills = useMemo(() => 
    getPotentialFixedBillsForMonth(currentDate, trackerManagedBills)
  , [getPotentialFixedBillsForMonth, currentDate, trackerManagedBills]);
  
  const futureFixedBills = useMemo(() => 
    getFutureFixedBills(currentDate, trackerManagedBills)
  , [getFutureFixedBills, currentDate, trackerManagedBills]);

  const handleToggleFixedBill = useCallback((potentialBill: PotentialFixedBill, isChecked: boolean) => {
    if (isChecked) {
      const newBill: BillTracker = {
        id: generateBillId(),
        type: 'tracker',
        description: potentialBill.description,
        dueDate: potentialBill.dueDate,
        expectedAmount: potentialBill.expectedAmount,
        sourceType: potentialBill.sourceType,
        sourceRef: potentialBill.sourceRef,
        parcelaNumber: potentialBill.parcelaNumber,
        isPaid: potentialBill.isPaid,
        isExcluded: false,
        suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id || '',
        suggestedCategoryId: potentialBill.sourceType === 'insurance_installment' ? 'cat_seguro' : 'cat_emprestimo'
      };
      setBillsTracker(prev => [...prev, newBill]);
      toast.success("Conta adicionada à lista!");
    } else {
      setBillsTracker(prev => prev.filter(b => 
        !(b.sourceType === potentialBill.sourceType && 
          b.sourceRef === potentialBill.sourceRef && 
          b.parcelaNumber === potentialBill.parcelaNumber)
      ));
      toast.info("Conta removida da lista.");
    }
  }, [contasMovimento, setBillsTracker]);

  const handleTogglePaid = useCallback((bill: BillTracker, isChecked: boolean) => {
    updateBill(bill.id, { isPaid: isChecked, paymentDate: isChecked ? format(new Date(), 'yyyy-MM-dd') : undefined });
    
    // Sincroniza com as entidades (Empréstimo/Seguro) se necessário
    if (isChecked) {
        if (bill.sourceType === 'loan_installment' && bill.sourceRef) {
            markLoanParcelPaid(Number(bill.sourceRef), bill.expectedAmount, format(new Date(), 'yyyy-MM-dd'), bill.parcelaNumber);
        } else if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
            markSeguroParcelPaid(Number(bill.sourceRef), bill.parcelaNumber, `manual_${Date.now()}`);
        }
    }
    
    toast.success(isChecked ? "Pagamento registrado!" : "Pagamento removido.");
  }, [updateBill, markLoanParcelPaid, markSeguroParcelPaid]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header com Navegação de Data e Ações Principais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(prev => subMonths(prev, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium capitalize min-w-[120px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(prev => addMonths(prev, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPurchaseModalOpen(true)} className="gap-2 rounded-xl h-10 border-2">
            <ShoppingCart className="w-4 h-4 text-pink-500" />
            <span className="hidden sm:inline">Nova Compra Parcelada</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsManageModalOpen(true)} className="gap-2 rounded-xl h-10 border-2">
            <Settings className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Gerenciar Fixas</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsAdvanceModalOpen(true)} className="gap-2 rounded-xl h-10 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            <span>Adiantar Parcelas</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Coluna Principal: Lista de Contas */}
        <div className="min-h-[600px] flex flex-col">
          <BillsTrackerList 
            bills={combinedBills}
            onUpdateBill={updateBill}
            onDeleteBill={deleteBill}
            onAddBill={(b) => setBillsTracker(prev => [...prev, { ...b, id: generateBillId(), type: 'tracker', isPaid: false }])}
            onTogglePaid={handleTogglePaid}
            currentDate={currentDate}
          />
        </div>

        {/* Sidebar: KPIs e Resumos */}
        <aside className="space-y-6">
          <BillsSidebarKPIs 
            currentDate={currentDate}
            totalPendingBills={combinedBills.filter(b => !b.isPaid).reduce((acc, b) => acc + b.expectedAmount, 0)}
            totalPaidBills={combinedBills.filter(b => b.isPaid).reduce((acc, b) => acc + b.expectedAmount, 0)}
          />

          <div className="glass-card p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Plus className="w-4 h-4" /> Dicas Rápidas
            </h4>
            <div className="space-y-3">
              <div className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-3 h-3 text-primary" />
                </div>
                <p>Use o <strong>Gerenciar Fixas</strong> para trazer parcelas de empréstimos e seguros deste mês.</p>
              </div>
              <div className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3 h-3 text-success" />
                </div>
                <p>Contas pagas são automaticamente contabilizadas no saldo da conta escolhida.</p>
              </div>
              <div className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-3 h-3 text-orange-500" />
                </div>
                <p>Clique no valor para editar o montante esperado de contas variáveis ou avulsas.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modais de Gerenciamento */}
      <FixedBillSelectorModal
        open={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        mode="current"
        currentDate={currentDate}
        potentialFixedBills={potentialFixedBills}
        onToggleFixedBill={handleToggleFixedBill}
      />

      <FixedBillSelectorModal
        open={isAdvanceModalOpen}
        onOpenChange={setIsAdvanceModalOpen}
        mode="future"
        currentDate={currentDate}
        potentialFixedBills={futureFixedBills}
        onToggleFixedBill={handleToggleFixedBill}
      />

      <AddPurchaseInstallmentDialog 
        open={isPurchaseModalOpen}
        onOpenChange={setIsPurchaseModalOpen}
        currentDate={currentDate}
      />
    </div>
  );
}