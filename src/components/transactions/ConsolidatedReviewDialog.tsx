import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Check, Loader2, AlertCircle, Calendar, ArrowRight, X, Settings, Sparkles, LayoutDashboard } from "lucide-react";
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

// Interface simplificada para Empréstimo
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

// Interface simplificada para Investimento
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
  
  // Estado para o período de filtro
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

  useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, loadTransactions]);
  
  const handleUpdateTransaction = useCallback((id: string, updates: Partial<ImportedTransaction>) => {
    setTransactionsToReview(prev => prev.map(tx => {
      if (tx.id === id) {
        const updatedTx = { ...tx, ...updates };
        if (updates.operationType && updates.operationType !== tx.operationType) {
            updatedTx.destinationAccountId = null;
            updatedTx.tempInvestmentId = null;
            updatedTx.tempLoanId = null;
            updatedTx.tempVehicleOperation = null;
            updatedTx.tempParcelaId = null;
            updatedTx.isTransfer = updates.operationType === 'transferencia';
        }
        return updatedTx;
      }
      return tx;
    }));
  }, []);
  
  const handleCreateRule = (tx: ImportedTransaction) => {
    setTxForRule(tx);
    setShowRuleModal(true);
  };
  
  const handleSaveRule = (rule: Omit<StandardizationRule, "id">) => {
    addStandardizationRule(rule);
    toast.success("Regra salva!");
    loadTransactions();
  };

  const handleContabilize = () => {
    const txsToContabilize = transactionsToReview.filter(tx => {
      if (tx.isPotentialDuplicate) return false; 
      const isCategorized = tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo';
      return !!isCategorized;
    });
    
    if (txsToContabilize.length === 0) {
      toast.error("Nenhuma transação pronta.");
      return;
    }
    
    setLoading(true);
    const newTransactions: TransacaoCompleta[] = [];
    const updatedStatements = new Map<string, ImportedStatement>();
    
    const txToStatementMap = new Map<string, string>();
    importedStatements.forEach(s => {
        s.rawTransactions.forEach(t => txToStatementMap.set(t.id, s.id));
    });

    txsToContabilize.forEach(tx => {
      const transactionId = generateTransactionId();
      const now = new Date().toISOString();
      const account = accounts.find(a => a.id === tx.accountId);
      const isCreditCard = account?.accountType === 'cartao_credito';
      let flow = getFlowTypeFromOperation(tx.operationType!, tx.tempVehicleOperation || undefined);
      
      if (isCreditCard) {
        if (tx.operationType === 'despesa') flow = 'out'; 
        else if (tx.operationType === 'transferencia') flow = 'in'; 
      }

      const baseTx: TransacaoCompleta = {
        id: transactionId,
        date: tx.date,
        accountId: tx.accountId,
        flow,
        operationType: tx.operationType!,
        domain: getDomainFromOperation(tx.operationType!),
        amount: tx.amount,
        categoryId: tx.categoryId || null,
        description: tx.description,
        links: {
          investmentId: tx.tempInvestmentId || null,
          loanId: tx.tempLoanId || null,
          transferGroupId: null,
          parcelaId: tx.tempParcelaId || null,
          vehicleTransactionId: null,
        } as TransactionLinks,
        conciliated: true,
        attachments: [],
        meta: {
          createdBy: 'system',
          source: 'import',
          createdAt: now,
          originalDescription: tx.originalDescription,
          vehicleOperation: tx.operationType === 'veiculo' ? tx.tempVehicleOperation || undefined : undefined,
        }
      };
      
      if (tx.isTransfer && tx.destinationAccountId) {
        const groupId = generateTransferGroupId();
        baseTx.links.transferGroupId = groupId;
        const fromAccount = accounts.find(a => a.id === tx.accountId);
        const toAccount = accounts.find(a => a.id === tx.destinationAccountId);
        const isToCreditCard = toAccount?.accountType === 'cartao_credito';
        
        const outTx: TransacaoCompleta = {
          ...baseTx,
          flow: 'transfer_out',
          description: tx.description || `Transferência para ${toAccount?.name}`,
        };
        newTransactions.push(outTx);
        
        const inTx: TransacaoCompleta = {
          ...baseTx,
          id: generateTransactionId(),
          accountId: tx.destinationAccountId,
          flow: isToCreditCard ? 'in' : 'transfer_in', 
          operationType: 'transferencia' as const,
          description: isToCreditCard ? `Pagamento de fatura CC ${toAccount?.name}` : tx.description || `Transferência recebida de ${fromAccount?.name}`,
          links: { ...baseTx.links, transferGroupId: groupId },
          conciliated: false, 
        };
        newTransactions.push(inTx);
      } 
      else if (tx.operationType === 'aplicacao' || tx.operationType === 'resgate') {
        const isAplicacao = tx.operationType === 'aplicacao';
        const groupId = isAplicacao ? `app_${Date.now()}` : `res_${Date.now()}`;
        baseTx.links.transferGroupId = groupId;
        newTransactions.push(baseTx);
        const secondaryTx: TransacaoCompleta = {
          ...baseTx,
          id: generateTransactionId(),
          accountId: tx.tempInvestmentId!,
          flow: isAplicacao ? 'in' : 'out',
          operationType: isAplicacao ? 'aplicacao' : 'resgate',
          domain: 'investment',
          description: isAplicacao ? (tx.description || `Aplicação recebida`) : (tx.description || `Resgate enviado`),
          links: { ...baseTx.links, investmentId: baseTx.accountId },
          meta: { ...baseTx.meta, createdBy: 'system' },
          conciliated: false,
        };
        newTransactions.push(secondaryTx);
      }
      else if (tx.operationType === 'liberacao_emprestimo') {
        newTransactions.push(baseTx);
        addEmprestimo({
          contrato: tx.description,
          valorTotal: tx.amount,
          parcela: 0,
          meses: 0,
          taxaMensal: 0,
          status: 'pendente_config',
          liberacaoTransactionId: baseTx.id,
          contaCorrenteId: baseTx.accountId,
          dataInicio: baseTx.date,
        });
      }
      else if (tx.operationType === 'pagamento_emprestimo' && tx.tempLoanId) {
        newTransactions.push(baseTx);
        const loanIdNum = parseInt(tx.tempLoanId.replace('loan_', ''));
        const parcelaNum = tx.tempParcelaId ? parseInt(tx.tempParcelaId) : undefined;
        if (!isNaN(loanIdNum)) markLoanParcelPaid(loanIdNum, tx.amount, tx.date, parcelaNum);
      }
      else if (tx.operationType === 'veiculo' && tx.tempVehicleOperation === 'compra') {
        newTransactions.push(baseTx);
        addVeiculo({
            modelo: tx.description,
            marca: '',
            tipo: 'carro', 
            ano: 0,
            dataCompra: tx.date,
            valorVeiculo: tx.amount,
            valorSeguro: 0,
            vencimentoSeguro: "",
            parcelaSeguro: 0,
            valorFipe: 0,
            compraTransactionId: baseTx.id,
            status: 'pendente_cadastro',
        });
      }
      else {
        newTransactions.push(baseTx);
      }
      
      const statementId = txToStatementMap.get(tx.id);
      if (statementId) {
          if (!updatedStatements.has(statementId)) {
              const originalStatement = importedStatements.find(s => s.id === statementId);
              if (originalStatement) updatedStatements.set(statementId, { ...originalStatement });
          }
          const statement = updatedStatements.get(statementId);
          if (statement) {
              statement.rawTransactions = statement.rawTransactions.map(rawTx => 
                  rawTx.id === tx.id ? { ...rawTx, isContabilized: true, contabilizedTransactionId: transactionId } : rawTx
              );
          }
      }
    });
    
    newTransactions.forEach(t => addTransacaoV2(t));
    updatedStatements.forEach(s => {
        const pendingCount = s.rawTransactions.filter(t => !t.isContabilized).length;
        const newStatus = pendingCount === 0 ? 'complete' : 'partial';
        updateImportedStatement(s.id, { rawTransactions: s.rawTransactions, status: newStatus });
    });
    
    setLoading(false);
    toast.success(`${txsToContabilize.length} transações contabilizadas!`);
    onOpenChange(false);
  };
  
  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setReviewRange(ranges.range1);
  }, []);
  
  const handleApplyFilter = () => loadTransactions();
  const handleManageRules = () => setShowRuleManagerModal(true);
  
  const readyToContabilizeCount = useMemo(() => transactionsToReview.filter(tx => {
    if (tx.isPotentialDuplicate) return false; 
    return tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo';
  }).length, [transactionsToReview]);
  
  const pendingCount = useMemo(() => transactionsToReview.filter(tx => {
    if (tx.isPotentialDuplicate) return false; 
    const isCategorized = tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo';
    return !isCategorized;
  }).length, [transactionsToReview]);
  
  const totalCount = transactionsToReview.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <ResizableDialogContent 
          storageKey="consolidated_review_modal"
          initialWidth={1450}
          initialHeight={880}
          minWidth={1000}
          minHeight={700}
          maxWidth={1800}
          maxHeight={1200}
          hideCloseButton={true} 
          className="p-0 border-none shadow-3xl bg-card rounded-[3rem] overflow-hidden"
        >
          <DialogHeader className="px-8 pt-8 pb-6 bg-muted/20 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <LayoutDashboard className="w-8 h-8" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold tracking-tight">Revisão Consolidada</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 rounded-full">
                        <Wallet className="w-3 h-3 mr-1.5" />
                        {account?.name}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-full hover:bg-muted"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden"> 
            
            {/* Coluna Lateral Redimensionável Expressiva */}
            <ResizableSidebar
                initialWidth={360}
                minWidth={280}
                maxWidth={450}
                storageKey="review_sidebar_width_v2"
            >
                <div className="h-full bg-muted/10 border-r border-border/40">
                    <ReviewContextSidebar
                        accountId={accountId}
                        statements={importedStatements.filter(s => s.accountId === accountId)}
                        pendingCount={pendingCount}
                        readyToContabilizeCount={readyToContabilizeCount}
                        totalCount={totalCount}
                        reviewRange={reviewRange}
                        onPeriodChange={handlePeriodChange}
                        onApplyFilter={handleApplyFilter}
                        onContabilize={handleContabilize}
                        onClose={() => onOpenChange(false)}
                        onManageRules={handleManageRules}
                    />
                </div>
            </ResizableSidebar>

            {/* Coluna Principal Expressiva */}
            <div className="flex-1 flex flex-col bg-background">
                <div className="px-8 py-5 flex items-center justify-between border-b border-border/40 bg-muted/5">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                        Fila de Processamento
                    </h3>
                  </div>
                  <Badge className="bg-muted text-muted-foreground rounded-full px-4 h-8 font-bold border-none">
                    {format(reviewRange.from || new Date(), 'dd MMM', { locale: ptBR })} — {format(reviewRange.to || new Date(), 'dd MMM yyyy', { locale: ptBR })}
                  </Badge>
                </div>
                
                <div className="flex-1 p-8 overflow-hidden">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-pulse">
                      <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin mb-6" />
                      <p className="text-xl font-bold uppercase tracking-widest">Sincronizando Dados...</p>
                    </div>
                  ) : transactionsToReview.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in zoom-in duration-500">
                      <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center text-success mb-6">
                        <Check className="w-12 h-12" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">Tudo limpo!</p>
                      <p className="text-sm mt-2 max-w-sm text-center leading-relaxed">Nenhuma transação pendente detectada para este período de datas.</p>
                      <Button variant="outline" className="mt-8 rounded-full h-12 px-8 border-border/60" onClick={() => onOpenChange(false)}>Voltar ao Início</Button>
                    </div>
                  ) : (
                    <div className="h-full rounded-[2rem] border border-border/40 overflow-hidden shadow-soft bg-muted/5">
                        <ScrollArea className="h-full">
                            <TransactionReviewTable
                              transactions={transactionsToReview}
                              accounts={accounts}
                              categories={categories}
                              investments={investments}
                              loans={loans}
                              onUpdateTransaction={handleUpdateTransaction}
                              onCreateRule={handleCreateRule}
                            />
                        </ScrollArea>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </ResizableDialogContent>
      </Dialog>
      
      <StandardizationRuleFormModal
        open={showRuleModal}
        onOpenChange={setShowRuleModal}
        initialTransaction={txForRule}
        categories={categories}
        onSave={handleSaveRule}
      />
      
      <StandardizationRuleManagerModal
        open={showRuleManagerModal}
        onOpenChange={setShowRuleManagerModal}
        rules={standardizationRules}
        onDeleteRule={deleteStandardizationRule}
        categories={categories}
      />
    </>
  );
}

import { ptBR } from "date-fns/locale";
import { Wallet } from "lucide-react";