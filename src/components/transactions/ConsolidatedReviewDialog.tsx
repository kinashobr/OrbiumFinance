import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Check, Loader2, X, Settings, Sparkles, Filter, Info } from "lucide-react";
import { 
  ContaCorrente, Categoria, ImportedTransaction, StandardizationRule, 
  TransacaoCompleta, TransferGroup, generateTransactionId, generateTransferGroupId, 
  getDomainFromOperation, getFlowTypeFromOperation, DateRange, ComparisonDateRanges,
  ImportedStatement,
  TransactionLinks
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";
import { TransactionReviewTable } from "./TransactionReviewTable";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { ReviewContextSidebar } from "./ReviewContextSidebar";
import { StandardizationRuleManagerModal } from "./StandardizationRuleManagerModal";
import { ResizableSidebar } from "./ResizableSidebar";
import { startOfMonth, endOfMonth, format, subDays, startOfDay, endOfDay } from "date-fns";
import { ResizableDialogContent } from "../ui/ResizableDialogContent";

interface LoanInfo {
  id: string;
  institution: string;
  numeroContrato?: string;
  parcelas: {
    numero: number;
    vencimento: string;
    valor: number;
    paga: boolean;
    transactionId?: string;
  }[];
  valorParcela: number;
  totalParcelas: number;
}

interface InvestmentInfo {
  id: string;
  name: string;
}

interface ConsolidatedReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accounts: ContaCorrente[];
  categories: Categoria[];
  investments: InvestmentInfo[];
  loans: LoanInfo[];
}

export function ConsolidatedReviewDialog({
  open,
  onOpenChange,
  accountId,
  accounts,
  categories,
  investments,
  loans,
}: ConsolidatedReviewDialogProps) {
  const {
    getTransactionsForReview,
    standardizationRules,
    addStandardizationRule,
    deleteStandardizationRule,
    addTransacaoV2,
    updateImportedStatement,
    importedStatements,
    markLoanParcelPaid,
    markSeguroParcelPaid,
    addEmprestimo,
    addVeiculo,
  } = useFinance();
  
  const account = accounts.find(a => a.id === accountId);
  const [reviewRange, setReviewRange] = useState<DateRange>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  
  const [transactionsToReview, setTransactionsToReview] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [txForRule, setTxForRule] = useState<ImportedTransaction | null>(null);
  const [showRuleManagerModal, setShowRuleManagerModal] = useState(false);

  const loadTransactions = useCallback(() => {
    if (!reviewRange.from || !reviewRange.to) {
      setTransactionsToReview([]);
      return;
    }
    setLoading(true);
    const consolidatedTxs = getTransactionsForReview(accountId, reviewRange);
    setTransactionsToReview(consolidatedTxs.map(tx => ({ ...tx })));
    setLoading(false);
  }, [accountId, reviewRange, getTransactionsForReview]);

  useEffect(() => { if (open) loadTransactions(); }, [open, loadTransactions]);
  
  const handleUpdateTransaction = useCallback((id: string, updates: Partial<ImportedTransaction>) => {
    setTransactionsToReview(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  }, []);
  
  const handleCreateRule = (tx: ImportedTransaction) => { setTxForRule(tx); setShowRuleModal(true); };
  
  const handleSaveRule = (rule: Omit<StandardizationRule, "id">) => {
    addStandardizationRule(rule);
    toast.success("Regra aplicada!");
    loadTransactions();
  };

  const handleContabilize = () => {
    const txsToContabilize = transactionsToReview.filter(tx => {
      if (tx.isPotentialDuplicate) return false; 
      return tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo';
    });
    
    if (txsToContabilize.length === 0) {
      toast.error("Categorize as transações antes de contabilizar.");
      return;
    }
    
    setLoading(true);
    const newTransactions: TransacaoCompleta[] = [];
    const updatedStatements = new Map<string, ImportedStatement>();
    const txToStatementMap = new Map<string, string>();
    importedStatements.forEach(s => s.rawTransactions.forEach(t => txToStatementMap.set(t.id, s.id)));

    txsToContabilize.forEach(tx => {
      const transactionId = generateTransactionId();
      let flow = getFlowTypeFromOperation(tx.operationType!, tx.tempVehicleOperation || undefined);
      const isCreditCard = accounts.find(a => a.id === tx.accountId)?.accountType === 'cartao_credito';
      if (isCreditCard) flow = tx.operationType === 'despesa' ? 'out' : 'in';

      const baseTx: TransacaoCompleta = {
        id: transactionId, date: tx.date, accountId: tx.accountId, flow, operationType: tx.operationType!, domain: getDomainFromOperation(tx.operationType!),
        amount: tx.amount, categoryId: tx.categoryId || null, description: tx.description, links: { investmentId: tx.tempInvestmentId || null, loanId: tx.tempLoanId || null, transferGroupId: null, parcelaId: tx.tempParcelaId || null, vehicleTransactionId: null },
        conciliated: true, attachments: [], meta: { createdBy: 'system', source: 'import', createdAt: new Date().toISOString(), originalDescription: tx.originalDescription, vehicleOperation: tx.operationType === 'veiculo' ? tx.tempVehicleOperation || undefined : undefined }
      };
      
      if (tx.isTransfer && tx.destinationAccountId) {
        const groupId = generateTransferGroupId();
        baseTx.links.transferGroupId = groupId;
        newTransactions.push({ ...baseTx, flow: 'transfer_out' });
        const toAcc = accounts.find(a => a.id === tx.destinationAccountId);
        newTransactions.push({ ...baseTx, id: generateTransactionId(), accountId: tx.destinationAccountId, flow: toAcc?.accountType === 'cartao_credito' ? 'in' : 'transfer_in', description: tx.description || `Transferência para ${toAcc?.name}`, links: { ...baseTx.links, transferGroupId: groupId }, conciliated: false });
      } else if (tx.operationType === 'aplicacao' || tx.operationType === 'resgate') {
        const isApp = tx.operationType === 'aplicacao';
        const gid = `app_${Date.now()}`; baseTx.links.transferGroupId = gid;
        newTransactions.push(baseTx);
        newTransactions.push({ ...baseTx, id: generateTransactionId(), accountId: tx.tempInvestmentId!, flow: isApp ? 'in' : 'out', operationType: isApp ? 'aplicacao' : 'resgate', domain: 'investment', links: { ...baseTx.links, investmentId: baseTx.accountId }, conciliated: false });
      } else {
        newTransactions.push(baseTx);
        if (tx.operationType === 'liberacao_emprestimo') addEmprestimo({ contrato: tx.description, valorTotal: tx.amount, parcela: 0, meses: 0, taxaMensal: 0, status: 'pendente_config', liberacaoTransactionId: baseTx.id, contaCorrenteId: baseTx.accountId, dataInicio: baseTx.date });
        if (tx.operationType === 'pagamento_emprestimo' && tx.tempLoanId) markLoanParcelPaid(parseInt(tx.tempLoanId.replace('loan_', '')), tx.amount, tx.date, tx.tempParcelaId ? parseInt(tx.tempParcelaId) : undefined);
        if (tx.operationType === 'veiculo' && tx.tempVehicleOperation === 'compra') addVeiculo({ modelo: tx.description, marca: '', tipo: 'carro', ano: 0, dataCompra: tx.date, valorVeiculo: tx.amount, valorSeguro: 0, vencimentoSeguro: "", parcelaSeguro: 0, valorFipe: 0, compraTransactionId: baseTx.id, status: 'pendente_cadastro' });
      }
      
      const sid = txToStatementMap.get(tx.id);
      if (sid) {
          if (!updatedStatements.has(sid)) updatedStatements.set(sid, { ...importedStatements.find(s => s.id === sid)! });
          const s = updatedStatements.get(sid)!;
          s.rawTransactions = s.rawTransactions.map(raw => raw.id === tx.id ? { ...raw, isContabilized: true, contabilizedTransactionId: transactionId } : raw);
      }
    });
    
    newTransactions.forEach(t => addTransacaoV2(t));
    updatedStatements.forEach(s => updateImportedStatement(s.id, { rawTransactions: s.rawTransactions, status: s.rawTransactions.filter(t => !t.isContabilized).length === 0 ? 'complete' : 'partial' }));
    
    setLoading(false);
    toast.success(`${txsToContabilize.length} transações processadas.`);
    onOpenChange(false);
  };
  
  const readyCount = useMemo(() => transactionsToReview.filter(tx => !tx.isPotentialDuplicate && (tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo')).length, [transactionsToReview]);
  const pendingCount = useMemo(() => transactionsToReview.filter(tx => !tx.isPotentialDuplicate && !(tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo')).length, [transactionsToReview]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <ResizableDialogContent 
          storageKey="consolidated_review_modal"
          initialWidth={1400} initialHeight={850} minWidth={900} minHeight={600} hideCloseButton={true}
          className="rounded-[2.5rem] bg-surface-light dark:bg-surface-dark border-none shadow-2xl"
        >
          <DialogHeader className="px-8 pt-8 pb-4 bg-surface-light dark:bg-surface-dark shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">Painel de Revisão</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    {account?.name} • Extratos Importados
                  </DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-black/5" onClick={() => onOpenChange(false)}><X className="w-5 h-5" /></Button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            <ResizableSidebar initialWidth={320} minWidth={240} maxWidth={400} storageKey="review_sidebar_width">
                <div className="h-full bg-surface-light dark:bg-surface-dark border-r border-border/40">
                  <ReviewContextSidebar
                      accountId={accountId} statements={importedStatements.filter(s => s.accountId === accountId)}
                      pendingCount={pendingCount} readyToContabilizeCount={readyCount} totalCount={transactionsToReview.length}
                      reviewRange={reviewRange} onPeriodChange={r => setReviewRange(r.range1)} onApplyFilter={loadTransactions}
                      onContabilize={handleContabilize} onClose={() => onOpenChange(false)} onManageRules={() => setShowRuleManagerModal(true)}
                  />
                </div>
            </ResizableSidebar>

            <div className="flex-1 flex flex-col p-6 overflow-hidden bg-background">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                   <Filter className="w-3.5 h-3.5" /> Lançamentos Pendentes
                </h3>
                <div className="flex items-center gap-2">
                   <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold">
                    {transactionsToReview.length} itens no período
                   </Badge>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden glass-card p-0 rounded-[2rem] border-border/20 shadow-expressive">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-50"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold uppercase tracking-widest text-xs">Sincronizando...</p></div>
                ) : transactionsToReview.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30"><Check className="w-16 h-16 text-success mb-4" /><p className="text-lg font-black">Tudo revisado!</p><p className="text-sm">Seu fluxo está 100% categorizado.</p></div>
                ) : (
                  <ScrollArea className="h-full">
                    <TransactionReviewTable
                      transactions={transactionsToReview} accounts={accounts} categories={categories}
                      investments={investments} loans={loans} onUpdateTransaction={handleUpdateTransaction} onCreateRule={handleCreateRule}
                    />
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
        </ResizableDialogContent>
      </Dialog>
      
      <StandardizationRuleFormModal open={showRuleModal} onOpenChange={setShowRuleModal} initialTransaction={txForRule} categories={categories} onSave={handleSaveRule} />
      <StandardizationRuleManagerModal open={showRuleManagerModal} onOpenChange={setShowRuleManagerModal} rules={standardizationRules} onDeleteRule={deleteStandardizationRule} categories={categories} />
    </>
  );
}