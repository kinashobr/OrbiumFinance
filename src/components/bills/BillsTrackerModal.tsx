import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, CalendarCheck, Repeat, Shield, Building2, DollarSign, Info, Settings, ShoppingCart, ChevronLeft, ChevronRight, X, CheckCircle2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillTracker, PotentialFixedBill, BillSourceType, formatCurrency, generateBillId, TransactionLinks, OperationType, BillDisplayItem, ExternalPaidBill } from "@/types/finance";
import { BillsTrackerList } from "./BillsTrackerList";
// import { BillsTrackerMobileList } from "./BillsTrackerMobileList";
import { FixedBillsList } from "./FixedBillsList";
import { BillsSidebarKPIs } from "./BillsSidebarKPIs";
import { FixedBillSelectorModal } from "./FixedBillSelectorModal";
import { AddPurchaseInstallmentDialog } from "./AddPurchaseInstallmentDialog";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn, parseDateLocal } from "@/lib/utils";
import { ResizableDialogContent } from "../ui/ResizableDialogContent";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type PartialTransactionLinks = Partial<TransactionLinks>;

const isBillTracker = (bill: BillDisplayItem): bill is BillTracker => {
    return bill.type === 'tracker';
};

interface BillsTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillsTrackerModal({ open, onOpenChange }: BillsTrackerModalProps) {
  const { 
    billsTracker,
    setBillsTracker, 
    updateBill, 
    deleteBill, 
    getBillsForMonth, 
    getPotentialFixedBillsForMonth,
    getFutureFixedBills,
    getOtherPaidExpensesForMonth,
    contasMovimento,
    addTransacaoV2,
    setTransacoesV2,
    categoriasV2,
    emprestimos,
    segurosVeiculo,
    calculateLoanAmortizationAndInterest,
    markSeguroParcelPaid,
    markLoanParcelPaid,
    unmarkSeguroParcelPaid,
    unmarkLoanParcelPaid,
    transacoesV2, 
  } = useFinance();
  
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [showFixedBillSelector, setShowFixedBillSelector] = useState(false);
  const [fixedBillSelectorMode, setFixedBillSelectorMode] = useState<'current' | 'future'>('current');
  const [showAddPurchaseDialog, setShowAddPurchaseDialog] = useState(false);
  
  const trackerManagedBills = useMemo(() => getBillsForMonth(currentDate), [getBillsForMonth, currentDate]);
  const externalPaidBills = useMemo(() => getOtherPaidExpensesForMonth(currentDate), [getOtherPaidExpensesForMonth, currentDate]);
  
  const combinedBills: BillDisplayItem[] = useMemo(() => {
    const trackerPaidTxIds = new Set(trackerManagedBills
        .filter(b => b.isPaid && b.transactionId)
        .map(b => b.transactionId!)
    );
    const trackerBills: BillDisplayItem[] = trackerManagedBills;
    const externalBills: BillDisplayItem[] = externalPaidBills.filter(externalBill => !trackerPaidTxIds.has(externalBill.id));
    return [...trackerBills, ...externalBills];
  }, [trackerManagedBills, externalPaidBills]);
  
  const potentialFixedBills = useMemo(() => getPotentialFixedBillsForMonth(currentDate, trackerManagedBills), [getPotentialFixedBillsForMonth, currentDate, trackerManagedBills]);
  const futureFixedBills = useMemo(() => getFutureFixedBills(currentDate, trackerManagedBills), [getFutureFixedBills, currentDate, trackerManagedBills]);
  
  const totalUnpaidBills = useMemo(() => {
    const creditCardAccountIds = new Set(contasMovimento.filter(c => c.accountType === 'cartao_credito').map(c => c.id));
    return combinedBills.reduce((acc, b) => {
        const isCC = b.suggestedAccountId && creditCardAccountIds.has(b.suggestedAccountId);
        if (!b.isPaid || isCC) return acc + b.expectedAmount;
        return acc;
    }, 0);
  }, [combinedBills, contasMovimento]);
  
  const totalPaidBills = useMemo(() => {
    const creditCardAccountIds = new Set(contasMovimento.filter(c => c.accountType === 'cartao_credito').map(c => c.id));
    return combinedBills.reduce((acc, b) => {
        const isCC = b.suggestedAccountId && creditCardAccountIds.has(b.suggestedAccountId);
        if (b.isPaid && !isCC) return acc + b.expectedAmount;
        return acc;
    }, 0);
  }, [combinedBills, contasMovimento]);

  // Helpers específicos para o layout mobile "Pixel Style"
  const today = useMemo(() => new Date(), []);
  const todayMid = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

  const mobileBills = useMemo(() => {
    // Mantém tracker e extrato, mas em lista única ordenada por data de vencimento / pagamento
    const tracker = combinedBills.filter((b) => b.type === 'tracker') as BillTracker[];
    const external = combinedBills.filter((b) => b.type === 'external_paid') as ExternalPaidBill[];

    const pending = tracker
      .filter((b) => !b.isExcluded && !b.isPaid)
      .sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());

    const paid = [...tracker.filter((b) => b.isPaid && !b.isExcluded), ...external].sort(
      (a, b) =>
        parseDateLocal((b as BillTracker | ExternalPaidBill).paymentDate || b.dueDate).getTime() -
        parseDateLocal((a as BillTracker | ExternalPaidBill).paymentDate || a.dueDate).getTime()
    );

    return [...pending, ...paid];
  }, [combinedBills]);

  const upcomingInfo = useMemo(() => {
    const unpaid = combinedBills.filter((b) => !b.isPaid);
    if (!unpaid.length) {
      return { total: 0, nextDate: null as Date | null };
    }

    const unpaidWithDates = unpaid.map((b) => parseDateLocal(b.dueDate));
    const futureOrToday = unpaidWithDates.filter((d) => d >= todayMid);

    const referenceDates = futureOrToday.length ? futureOrToday : unpaidWithDates;
    const nextDate = referenceDates.reduce((min, d) => (d < min ? d : min), referenceDates[0]);

    const total = unpaid.reduce((acc, b) => (parseDateLocal(b.dueDate) >= todayMid ? acc + b.expectedAmount : acc), 0);

    return { total, nextDate };
  }, [combinedBills, todayMid]);

  const [newBillDescription, setNewBillDescription] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillDueDate, setNewBillDueDate] = useState(format(currentDate, "yyyy-MM-dd"));
  const newBillCardRef = useRef<HTMLDivElement | null>(null);

  const parseAmount = (value: string): number => {
    const parsed = parseFloat(value.replace(".", "").replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatAmountInput = (value: string) => {
    const cleaned = value.replace(/[^\d,]/g, "");
    const parts = cleaned.split(",");
    if (parts.length > 2) return value;
    return cleaned;
  };

  const handleAddAdHocBill = () => {
    const amount = parseAmount(newBillAmount);
    if (!newBillDescription || amount <= 0 || !newBillDueDate) return;

    handleAddBill({
      description: newBillDescription,
      dueDate: newBillDueDate,
      expectedAmount: amount,
      sourceType: "ad_hoc",
      suggestedAccountId: contasMovimento.find((c) => c.accountType === "corrente")?.id,
      suggestedCategoryId: null,
    });

    setNewBillDescription("");
    setNewBillAmount("");
    setNewBillDueDate(format(currentDate, "yyyy-MM-dd"));
  };

  const scrollToNewBillCard = () => {
    if (newBillCardRef.current) {
      newBillCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getBillStatus = (bill: BillDisplayItem): "pago" | "atrasado" | "pendente" => {
    if (bill.isPaid || bill.type === "external_paid") return "pago";
    const due = parseDateLocal(bill.dueDate);
    const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return dueMid < todayMid ? "atrasado" : "pendente";
  };

  const getBillStatusClasses = (status: "pago" | "atrasado" | "pendente") => {
    switch (status) {
      case "pago":
        return "bg-success/10 text-success";
      case "atrasado":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-warning/10 text-warning";
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };
  
  const handleUpdateBill = useCallback((id: string, updates: Partial<BillTracker>) => {
    updateBill(id, updates);
  }, [updateBill]);

  const handleDeleteBill = useCallback((id: string) => { deleteBill(id); }, [deleteBill]);
  const handleAddBill = useCallback((bill: Omit<BillTracker, "id" | "isPaid" | "type">) => { setBillsTracker(prev => [...prev, { ...bill, id: generateBillId(), type: 'tracker', isPaid: false, isExcluded: false }]); }, [setBillsTracker]);
  
  const handleTogglePaid = useCallback((bill: BillDisplayItem, isChecked: boolean) => {
    if (!isBillTracker(bill)) { toast.error("Não é possível alterar o status de pagamento de transações do extrato."); return; }
    const trackerBill = bill as BillTracker;
    if (isChecked) {
      const account = contasMovimento.find(c => c.id === trackerBill.suggestedAccountId);
      const category = categoriasV2.find(c => c.id === trackerBill.suggestedCategoryId);
      if (!account || !category) { toast.error("Conta ou categoria sugerida não encontrada."); return; }
      const transactionId = `bill_tx_${trackerBill.id}`;
      const baseLinks: Partial<TransactionLinks> = {};
      let description = trackerBill.description;
      const operationType: OperationType = trackerBill.sourceType === 'loan_installment' ? 'pagamento_emprestimo' : 'despesa';
      const domain = trackerBill.sourceType === 'loan_installment' ? 'financing' : 'operational';
      if (trackerBill.sourceType === 'loan_installment' && trackerBill.sourceRef && trackerBill.parcelaNumber) {
        const loanId = parseInt(trackerBill.sourceRef);
        const scheduleItem = calculateLoanAmortizationAndInterest(loanId, trackerBill.parcelaNumber);
        if (scheduleItem) {
            baseLinks.loanId = `loan_${loanId}`;
            baseLinks.parcelaId = String(trackerBill.parcelaNumber);
            const loan = emprestimos.find(e => e.id === loanId);
            description = `Pagamento Empréstimo ${loan?.contrato || 'N/A'} - P${trackerBill.parcelaNumber}/${loan?.meses || 'N/A'}`;
            markLoanParcelPaid(loanId, trackerBill.expectedAmount, format(new Date(), 'yyyy-MM-dd'), trackerBill.parcelaNumber);
        }
      }
      if (trackerBill.sourceType === 'insurance_installment' && trackerBill.sourceRef && trackerBill.parcelaNumber) {
        baseLinks.vehicleTransactionId = `${trackerBill.sourceRef}_${trackerBill.parcelaNumber}`;
        const seguroId = parseInt(trackerBill.sourceRef);
        markSeguroParcelPaid(seguroId, trackerBill.parcelaNumber, transactionId);
      }
      addTransacaoV2({ id: transactionId, date: format(new Date(), 'yyyy-MM-dd'), accountId: account.id, flow: 'out', operationType, domain, amount: trackerBill.expectedAmount, categoryId: category.id, description, links: { investmentId: null, transferGroupId: null, vehicleTransactionId: baseLinks.vehicleTransactionId || null, loanId: baseLinks.loanId || null, parcelaId: baseLinks.parcelaId || null }, conciliated: false, attachments: [], meta: { createdBy: 'bill_tracker', source: 'bill_tracker', createdAt: new Date().toISOString(), notes: `Gerado pelo Contas a Pagar. Bill ID: ${trackerBill.id}` } });
      updateBill(trackerBill.id, { isPaid: true, transactionId, paymentDate: format(new Date(), 'yyyy-MM-dd') });
      toast.success(`Conta "${trackerBill.description}" paga!`);
    } else {
      if (trackerBill.transactionId) {
        if (trackerBill.sourceType === 'loan_installment' && trackerBill.sourceRef && trackerBill.parcelaNumber) { unmarkLoanParcelPaid(parseInt(trackerBill.sourceRef)); }
        if (trackerBill.sourceType === 'insurance_installment' && trackerBill.sourceRef && trackerBill.parcelaNumber) { unmarkSeguroParcelPaid(parseInt(trackerBill.sourceRef), trackerBill.parcelaNumber); }
        setBillsTracker(prev => prev.map(b => b.id === trackerBill.id ? { ...b, isPaid: false, transactionId: undefined, paymentDate: undefined } : b));
        setTransacoesV2(prev => prev.filter(t => t.id !== trackerBill.transactionId));
        toast.info("Conta desmarcada e transação excluída.");
      } else {
        updateBill(trackerBill.id, { isPaid: false, paymentDate: undefined });
      }
    }
  }, [updateBill, addTransacaoV2, contasMovimento, categoriasV2, emprestimos, segurosVeiculo, calculateLoanAmortizationAndInterest, setBillsTracker, markSeguroParcelPaid, markLoanParcelPaid, unmarkSeguroParcelPaid, unmarkLoanParcelPaid, setTransacoesV2]);
  
  const handleToggleFixedBill = useCallback((potentialBill: PotentialFixedBill, isChecked: boolean) => {
    const { sourceType, sourceRef, parcelaNumber, dueDate, expectedAmount, description, isPaid } = potentialBill;
    if (transacoesV2.some(t => (sourceType === 'loan_installment' && t.links?.loanId === `loan_${sourceRef}` && t.links?.parcelaId === String(parcelaNumber)) || (sourceType === 'insurance_installment' && t.links?.vehicleTransactionId === `${sourceRef}_${parcelaNumber}`))) { toast.info("Esta parcela já possui transação vinculada."); return; }
    if (isChecked) {
        const isFutureBill = parseDateLocal(dueDate) > endOfMonth(currentDate);
        const newBill: BillTracker = { id: generateBillId(), type: 'tracker', description, dueDate, expectedAmount, sourceType, sourceRef, parcelaNumber, suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id, suggestedCategoryId: categoriasV2.find(c => (sourceType === 'loan_installment' && c.label.toLowerCase().includes('emprestimo')) || (sourceType === 'insurance_installment' && c.label.toLowerCase().includes('seguro')))?.id || null, isExcluded: false, isPaid: isFutureBill && !isPaid, paymentDate: isFutureBill && !isPaid ? format(new Date(), 'yyyy-MM-dd') : undefined, transactionId: isFutureBill && !isPaid ? `bill_tx_temp_${generateBillId()}` : undefined };
        if (newBill.isPaid && newBill.transactionId) {
            const account = contasMovimento.find(c => c.id === newBill.suggestedAccountId);
            const category = categoriasV2.find(c => c.id === newBill.suggestedCategoryId);
            if (!account || !category) return;
            const transactionId = newBill.transactionId;
            const baseLinks: Partial<TransactionLinks> = {};
            if (newBill.sourceType === 'loan_installment' && newBill.sourceRef && newBill.parcelaNumber) {
                const loanId = parseInt(newBill.sourceRef);
                baseLinks.loanId = `loan_${loanId}`; baseLinks.parcelaId = String(newBill.parcelaNumber);
                markLoanParcelPaid(loanId, newBill.expectedAmount, newBill.paymentDate!, newBill.parcelaNumber);
            }
            if (newBill.sourceType === 'insurance_installment' && newBill.sourceRef && newBill.parcelaNumber) {
                baseLinks.vehicleTransactionId = `${newBill.sourceRef}_${newBill.parcelaNumber}`;
                markSeguroParcelPaid(parseInt(newBill.sourceRef), newBill.parcelaNumber, transactionId);
            }
            addTransacaoV2({ id: transactionId, date: newBill.paymentDate!, accountId: account.id, flow: 'out', operationType: newBill.sourceType === 'loan_installment' ? 'pagamento_emprestimo' : 'despesa', domain: newBill.sourceType === 'loan_installment' ? 'financing' : 'operational', amount: newBill.expectedAmount, categoryId: category.id, description: newBill.description, links: { investmentId: null, transferGroupId: null, vehicleTransactionId: baseLinks.vehicleTransactionId || null, loanId: baseLinks.loanId || null, parcelaId: baseLinks.parcelaId || null }, conciliated: false, attachments: [], meta: { createdBy: 'bill_tracker', source: 'bill_tracker', createdAt: new Date().toISOString(), notes: `Adiantamento. Bill ID: ${newBill.id}` } });
            setBillsTracker(prev => [...prev, newBill]);
            toast.success(`Adiantamento registrado!`);
        } else {
            setBillsTracker(prev => [...prev, newBill]);
            toast.success("Conta fixa incluída.");
        }
    } else {
        setBillsTracker(prev => prev.filter(b => !(b.sourceType === sourceType && b.sourceRef === sourceRef && b.parcelaNumber === parcelaNumber)));
        const billToRemove = billsTracker.find(b => b.sourceType === sourceType && b.sourceRef === sourceRef && b.parcelaNumber === parcelaNumber);
        if (billToRemove && billToRemove.isPaid && billToRemove.transactionId) {
            if (billToRemove.sourceType === 'loan_installment' && billToRemove.sourceRef) unmarkLoanParcelPaid(parseInt(billToRemove.sourceRef));
            if (billToRemove.sourceType === 'insurance_installment' && billToRemove.sourceRef && billToRemove.parcelaNumber) unmarkSeguroParcelPaid(parseInt(billToRemove.sourceRef), billToRemove.parcelaNumber);
            setTransacoesV2(prev => prev.filter(t => t.id !== billToRemove.transactionId));
        }
    }
  }, [setBillsTracker, billsTracker, contasMovimento, categoriasV2, currentDate, addTransacaoV2, markLoanParcelPaid, markSeguroParcelPaid, unmarkLoanParcelPaid, unmarkSeguroParcelPaid, setTransacoesV2, transacoesV2]);

  // Desktop: conteúdo com tabela detalhada
  const renderDesktopContent = () => (
    <>
      {/* Header com navegação de mês */}
      <div className="flex items-center justify-between mb-4 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleMonthChange("prev")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-2 sm:px-4 min-w-[100px] sm:min-w-[120px] text-center">
            <span className="text-xs sm:text-sm font-bold text-foreground capitalize">
              {format(currentDate, "MMMM", { locale: ptBR })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleMonthChange("next")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPurchaseDialog(true)}
            className="text-[10px] sm:text-xs h-8 px-2 sm:px-3"
          >
            <ShoppingCart className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Compra Parcelada</span>
            <span className="sm:hidden">+ Parcela</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFixedBillSelectorMode("current");
              setShowFixedBillSelector(true);
            }}
            className="text-[10px] sm:text-xs h-8 px-2 sm:px-3"
          >
            <Settings className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Gerenciar Fixas</span>
            <span className="sm:hidden">Fixas</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFixedBillSelectorMode("future");
              setShowFixedBillSelector(true);
            }}
            className="text-[10px] sm:text-xs h-8 px-2 sm:px-3"
          >
            <Plus className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Adiantar</span>
            <span className="sm:hidden">Adiant.</span>
          </Button>
        </div>
      </div>

      {/* Lista de contas - tabela desktop */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <BillsTrackerList
          bills={combinedBills}
          onUpdateBill={handleUpdateBill}
          onDeleteBill={handleDeleteBill}
          onAddBill={handleAddBill}
          onTogglePaid={handleTogglePaid}
          currentDate={currentDate}
        />
      </div>
    </>
  );

  // Mobile: conteúdo em cards verticais (Pixel Style) – novo layout Contas a Pagar
  const renderMobileContent = () => (
    <>
      {/* Cabeçalho de navegação de mês */}
      <div className="flex items-center justify-between mb-3 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center bg-muted/50 rounded-2xl p-1 border border-border/50 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleMonthChange("prev")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-2 min-w-[90px] text-center">
            <p className="text-[11px] font-semibold text-foreground leading-tight">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
              Contas a pagar
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleMonthChange("next")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 flex flex-col overflow-hidden gap-3">
        <ScrollArea className="flex-1 overflow-y-auto pb-24 pr-1 animate-fade-in">
          <div className="space-y-3">
            {/* Cards-resumo principais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card shadow-lg shadow-primary/5 border border-border/60 px-3 py-2.5 flex flex-col justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                  Total a pagar
                </p>
                <p className="text-lg font-extrabold text-destructive leading-snug">
                  {formatCurrency(totalUnpaidBills)}
                </p>
              </div>

              <div className="rounded-2xl bg-card shadow-lg shadow-success/5 border border-border/60 px-3 py-2.5 flex flex-col justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                  Resistir programação
                </p>
                <p className="text-lg font-extrabold text-success leading-snug">
                  {formatCurrency(totalPaidBills)}
                </p>
              </div>

              <div className="col-span-2 rounded-2xl bg-card shadow-lg shadow-primary/5 border border-border/60 px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                    Próximos vencimentos
                  </p>
                  <p className="text-base font-extrabold text-primary leading-snug">
                    {formatCurrency(upcomingInfo.total)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarCheck className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {upcomingInfo.nextDate
                      ? format(upcomingInfo.nextDate, "dd/MM", { locale: ptBR })
                      : "Sem contas"}
                  </span>
                </div>
              </div>
            </div>

            {/* Nova Conta (compacto) */}
            <div
              ref={newBillCardRef}
              className="glass-card p-3 rounded-2xl bg-muted/30 border border-border/60 shrink-0"
            >
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground opacity-80">Nova conta</p>
                  <Input
                    value={newBillDescription}
                    onChange={(e) => setNewBillDescription(e.target.value)}
                    placeholder="Descrição..."
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="w-[90px] space-y-0.5">
                  <p className="text-[10px] text-muted-foreground opacity-80">Valor</p>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(formatAmountInput(e.target.value))}
                    placeholder="0,00"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="w-[110px] space-y-0.5">
                  <p className="text-[10px] text-muted-foreground opacity-80">Vencimento</p>
                  <Input
                    type="date"
                    value={newBillDueDate}
                    onChange={(e) => setNewBillDueDate(e.target.value)}
                    className="h-8 text-[11px] rounded-lg"
                  />
                </div>
                <Button
                  onClick={handleAddAdHocBill}
                  className="h-8 w-9 p-0"
                  disabled={!newBillDescription || parseAmount(newBillAmount) <= 0}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Contas do mês - lista principal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
                  Contas do mês
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                  <Info className="w-3 h-3" />
                  <span>{mobileBills.length} itens</span>
                </div>
              </div>

              <div className="space-y-2">
                {mobileBills.map((bill) => {
                  const status = getBillStatus(bill);
                  const isTracker = bill.type === "tracker";
                  const isPaid = bill.isPaid || bill.type === "external_paid";
                  const dueDate = parseDateLocal(bill.dueDate);

                  let Icon = DollarSign;
                  let label = "Despesa";
                  if (bill.sourceType === "loan_installment") {
                    Icon = Building2;
                    label = "Empréstimo";
                  } else if (bill.sourceType === "insurance_installment") {
                    Icon = Shield;
                    label = "Seguro";
                  } else if (bill.sourceType === "fixed_expense") {
                    Icon = Repeat;
                    label = "Fixa";
                  } else if (bill.sourceType === "purchase_installment") {
                    Icon = ShoppingCart;
                    label = "Parcela";
                  } else if (bill.sourceType === "ad_hoc") {
                    Icon = Info;
                    label = "Avulsa";
                  }

                  return (
                    <div
                      key={bill.id}
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 flex gap-3 items-center bg-card/95 shadow-sm",
                        "border-border/60",
                        status === "atrasado" && "border-destructive/40 bg-destructive/5",
                        status === "pago" && "border-success/40 bg-success/5",
                        bill.type === "external_paid" && "opacity-80"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-9 h-9 rounded-xl bg-muted/70 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 h-5 text-[9px] border-0 font-semibold text-muted-foreground"
                        >
                          {label}
                        </Badge>
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {bill.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {isTracker && bill.suggestedCategoryId
                            ? (categoriasV2.find((c) => c.id === bill.suggestedCategoryId)?.label || "Sem categoria")
                            : "Despesa do mês"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80">
                          {status === "pago" ? "Pago em " : "Vence em "}
                          {bill.paymentDate
                            ? format(parseDateLocal(bill.paymentDate), "dd/MM", { locale: ptBR })
                            : format(dueDate, "dd/MM", { locale: ptBR })}
                        </p>
                      </div>

                      <div className="flex flex-col items-end justify-between gap-1 self-stretch">
                        <p
                          className={cn(
                            "text-xs font-extrabold",
                            status === "pago" || bill.type === "external_paid"
                              ? "text-success"
                              : status === "atrasado"
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {formatCurrency(bill.expectedAmount)}
                        </p>

                        <div className="flex items-center gap-2">
                          {bill.type === "external_paid" ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : (
                            <Checkbox
                              className="h-4 w-4"
                              checked={isPaid}
                              onCheckedChange={(checked) =>
                                handleTogglePaid(bill, checked as boolean)
                              }
                            />
                          )}

                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[9px] font-semibold border-0",
                              getBillStatusClasses(status)
                            )}
                          >
                            {status === "pago"
                              ? "Concluído"
                              : status === "atrasado"
                              ? "Vencido"
                              : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Procedimentos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
                  Procedimentos
                </p>
              </div>

              <div className="rounded-2xl bg-muted/40 border border-border/60 p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Settings className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Contas fixas</p>
                      <p className="text-[10px] text-muted-foreground">Gerenciadas automaticamente</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                    {potentialFixedBills.length + futureFixedBills.length} itens
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-xl bg-card/60 border border-border/60 p-2 flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Pendentes
                    </span>
                    <span className="text-xs font-semibold">
                      {formatCurrency(totalUnpaidBills)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-card/60 border border-border/60 p-2 flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Pagas
                    </span>
                    <span className="text-xs font-semibold">
                      {formatCurrency(totalPaidBills)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-card/60 border border-border/60 p-2 flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Fixas
                    </span>
                    <span className="text-xs font-semibold">
                      {potentialFixedBills.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Rodapé com ações principais */}
        <div className="pt-2 pb-3 border-t border-border/60 bg-background/95 flex items-center justify-between gap-3 px-1">
          <Button
            className="flex-1 h-10 rounded-full text-sm font-semibold shadow-expressive bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={scrollToNewBillCard}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar conta
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => {
                setFixedBillSelectorMode("current");
                setShowFixedBillSelector(true);
              }}
            >
              <Repeat className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setShowAddPurchaseDialog(true)}
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  // Mobile: KPIs em cards horizontais (mantido para possíveis usos futuros, não exibido neste layout)
  const renderMobileKPIs = () => null;

  return (
    <>
      {/* Mobile: Sheet full-screen */}
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col">
            <SheetHeader className="px-4 pt-3 pb-2 border-b shrink-0 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-base font-bold">Contas a Pagar</SheetTitle>
                    <p className="text-[10px] text-muted-foreground">
                      {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="w-4 h-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            {/* KPIs Mobile */}
            {renderMobileKPIs()}

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden bg-background">
              {renderMobileContent()}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* Desktop: Dialog com ResizableDialogContent */
        <Dialog open={open} onOpenChange={onOpenChange}>
          <ResizableDialogContent 
            storageKey="bills_tracker_modal"
            initialWidth={1300}
            initialHeight={800}
            minWidth={900}
            minHeight={600}
            hideCloseButton={true}
            className="bg-card border-border overflow-hidden flex flex-col p-0"
          >
            <div className="modal-viewport">
              <DialogHeader className="px-6 pt-3 pb-3 border-b shrink-0 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <CalendarCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="cq-text-lg font-bold">Contas a Pagar</DialogTitle>
                      <p className="cq-text-xs text-muted-foreground">
                        Gestão de despesas de {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar de KPIs com largura proporcional e contêiner próprio */}
                <div className="w-[20%] min-w-[210px] max-w-[320px] shrink-0 border-r border-border bg-muted/10 sidebar-container">
                  <div className="p-4 overflow-y-auto h-full">
                    <BillsSidebarKPIs 
                      currentDate={currentDate}
                      totalPendingBills={totalUnpaidBills}
                      totalPaidBills={totalPaidBills}
                    />
                  </div>
                </div>

                {/* Conteúdo Principal Flexível */}
                <div className="flex-1 flex flex-col cq-p-md overflow-hidden bg-background">
                  {renderDesktopContent()}
                </div>
              </div>
            </div>
          </ResizableDialogContent>
        </Dialog>
      )}

      <FixedBillSelectorModal open={showFixedBillSelector} onOpenChange={setShowFixedBillSelector} mode={fixedBillSelectorMode} currentDate={currentDate} potentialFixedBills={fixedBillSelectorMode === 'current' ? potentialFixedBills : futureFixedBills} onToggleFixedBill={handleToggleFixedBill} />
      <AddPurchaseInstallmentDialog open={showAddPurchaseDialog} onOpenChange={setShowAddPurchaseDialog} currentDate={currentDate} />
    </>
  );
}