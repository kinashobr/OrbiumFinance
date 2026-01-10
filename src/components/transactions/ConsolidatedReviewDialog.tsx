import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Check, Loader2, X, Sparkles, Filter, ChevronLeft, Calendar, BarChart3, Settings } from "lucide-react";
import { 
  ContaCorrente, Categoria, ImportedTransaction, StandardizationRule, 
  TransacaoCompleta, generateTransactionId, generateTransferGroupId, 
  getDomainFromOperation, getFlowTypeFromOperation, DateRange,
  ImportedStatement
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { TransactionReviewTable } from "./TransactionReviewTable";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { StandardizationRuleManagerModal } from "./StandardizationRuleManagerModal";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  const {
    getTransactionsForReview,
    standardizationRules,
    addStandardizationRule,
    deleteStandardizationRule,
    addTransacaoV2,
    updateImportedStatement,
    importedStatements,
    markLoanParcelPaid,
    addEmprestimo,
    addVeiculo,
    uncontabilizeImportedTransaction
  } = useFinance();
  
  const account = accounts.find(a => a.id === accountId);
  const [reviewRange, setReviewRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  });
  
  const [transactionsToReview, setTransactionsToReview] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [txForRule, setTxForRule] = useState<ImportedTransaction | null>(null);
  const [showRuleManagerModal, setShowRuleManagerModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'filters'>('review');
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'custom'>('month');

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
      if (isMobile) setActiveTab('review');
    }
  }, [open, loadTransactions, isMobile]);
  
  const handleUpdateTransaction = useCallback((id: string, updates: Partial<ImportedTransaction>) => {
    setTransactionsToReview(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  }, []);
  
  const handleCreateRule = (tx: ImportedTransaction) => { 
    setTxForRule(tx); 
    setShowRuleModal(true); 
  };
  
  const handleSaveRule = (rule: Omit<StandardizationRule, "id">) => {
    addStandardizationRule(rule);
    toast.success("Regra criada com sucesso!");
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
          vehicleTransactionId: null 
        },
        conciliated: true, 
        attachments: [], 
        meta: { 
          createdBy: 'system', 
          source: 'import', 
          createdAt: new Date().toISOString(), 
          originalDescription: tx.originalDescription, 
          vehicleOperation: tx.operationType === 'veiculo' ? tx.tempVehicleOperation || undefined : undefined 
        }
      };
      
      if (tx.isTransfer && tx.destinationAccountId) {
        const groupId = generateTransferGroupId();
        baseTx.links.transferGroupId = groupId;
        newTransactions.push({ ...baseTx, flow: 'transfer_out' });
        const toAcc = accounts.find(a => a.id === tx.destinationAccountId);
        newTransactions.push({ 
          ...baseTx, 
          id: generateTransactionId(), 
          accountId: tx.destinationAccountId, 
          flow: toAcc?.accountType === 'cartao_credito' ? 'in' : 'transfer_in', 
          description: tx.description || `Transferência para ${toAcc?.name}`, 
          links: { ...baseTx.links, transferGroupId: groupId }, 
          conciliated: false 
        });
      } else if (tx.operationType === 'aplicacao' || tx.operationType === 'resgate') {
        const isApp = tx.operationType === 'aplicacao';
        const gid = `app_${Date.now()}`; 
        baseTx.links.transferGroupId = gid;
        newTransactions.push(baseTx);
        newTransactions.push({ 
          ...baseTx, 
          id: generateTransactionId(), 
          accountId: tx.tempInvestmentId!, 
          flow: isApp ? 'in' : 'out', 
          operationType: isApp ? 'aplicacao' : 'resgate', 
          domain: 'investment', 
          links: { ...baseTx.links, investmentId: baseTx.accountId }, 
          conciliated: false 
        });
      } else {
        newTransactions.push(baseTx);
        if (tx.operationType === 'liberacao_emprestimo') {
          addEmprestimo({ 
            contrato: tx.description, 
            valorTotal: tx.amount, 
            parcela: 0, 
            meses: 0, 
            taxaMensal: 0, 
            status: 'pendente_config', 
            liberacaoTransactionId: baseTx.id, 
            contaCorrenteId: baseTx.accountId, 
            dataInicio: baseTx.date 
          });
        }
        if (tx.operationType === 'pagamento_emprestimo' && tx.tempLoanId) {
          markLoanParcelPaid(
            parseInt(tx.tempLoanId.replace('loan_', '')), 
            tx.amount, 
            tx.date, 
            tx.tempParcelaId ? parseInt(tx.tempParcelaId) : undefined
          );
        }
        if (tx.operationType === 'veiculo' && tx.tempVehicleOperation === 'compra') {
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
            status: 'pendente_cadastro' 
          });
        }
      }
      
      const sid = txToStatementMap.get(tx.id);
      if (sid) {
        if (!updatedStatements.has(sid)) {
          updatedStatements.set(sid, { ...importedStatements.find(s => s.id === sid)! });
        }
        const s = updatedStatements.get(sid)!;
        s.rawTransactions = s.rawTransactions.map(raw => 
          raw.id === tx.id ? { ...raw, isContabilized: true, contabilizedTransactionId: transactionId } : raw
        );
      }
    });
    
    newTransactions.forEach(t => addTransacaoV2(t));
    updatedStatements.forEach(s => 
      updateImportedStatement(s.id, { 
        rawTransactions: s.rawTransactions, 
        status: s.rawTransactions.filter(t => !t.isContabilized).length === 0 ? 'complete' : 'partial' 
      })
    );
    
    setLoading(false);
    toast.success(`${txsToContabilize.length} transações processadas.`);
    onOpenChange(false);
  };
  
  const readyCount = useMemo(() => 
    transactionsToReview.filter(tx => 
      !tx.isPotentialDuplicate && 
      (tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo')
    ).length, 
    [transactionsToReview]
  );
  
  const pendingCount = useMemo(() => 
    transactionsToReview.filter(tx => 
      !tx.isPotentialDuplicate && 
      !(tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation || tx.operationType === 'liberacao_emprestimo')
    ).length, 
    [transactionsToReview]
  );

  // Filtros simplificados para mobile
  const quickPeriodOptions = [
    { label: 'Este mês', days: 30 },
    { label: 'Últimos 15 dias', days: 15 },
    { label: 'Últimos 7 dias', days: 7 },
  ];

  const handleQuickPeriodSelect = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setReviewRange({ from, to });
    loadTransactions();
  };

  const renderDesktopLayout = () => (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">Painel de Revisão</h3>
              <p className="text-sm text-muted-foreground">{account?.name}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedPeriod === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('month')}
                  className="text-xs"
                >
                  Este mês
                </Button>
                <Button
                  variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('custom')}
                  className="text-xs"
                >
                  Personalizado
                </Button>
              </div>
            </div>

            {selectedPeriod === 'custom' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">De</label>
                    <input
                      type="date"
                      value={reviewRange.from?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setReviewRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                      className="w-full mt-1 px-2 py-1 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Até</label>
                    <input
                      type="date"
                      value={reviewRange.to?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setReviewRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                      className="w-full mt-1 px-2 py-1 text-sm border rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-3">Resumo</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Total</span>
                  <Badge variant="secondary">{transactionsToReview.length}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <span className="text-sm">Prontas</span>
                  <Badge variant="default" className="bg-blue-500">{readyCount}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <span className="text-sm">Pendentes</span>
                  <Badge variant="outline">{pendingCount}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleContabilize} 
                disabled={readyCount === 0}
                className="w-full"
              >
                <Check className="w-4 h-4 mr-2" />
                Contabilizar {readyCount} itens
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowRuleManagerModal(true)}
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                Gerenciar Regras
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Transações para Revisão</h2>
              <p className="text-sm text-muted-foreground">
                Categorize cada transação para contabilização
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadTransactions}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando transações...</p>
            </div>
          ) : transactionsToReview.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Check className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tudo revisado!</h3>
              <p className="text-muted-foreground">Não há transações pendentes para este período.</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6">
                <TransactionReviewTable
                  transactions={transactionsToReview} 
                  accounts={accounts} 
                  categories={categories}
                  investments={investments} 
                  loans={loans} 
                  onUpdateTransaction={handleUpdateTransaction} 
                  onCreateRule={handleCreateRule}
                />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );

  const renderMobileLayout = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-10 w-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
              <h2 className="font-bold text-lg">Revisão</h2>
              <p className="text-xs text-muted-foreground">{account?.name}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowRuleManagerModal(true)}
          >
            <Sparkles className="w-5 h-5 text-primary" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v: 'review' | 'filters') => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="review">
              <FileText className="w-4 h-4 mr-2" />
              Revisão ({transactionsToReview.length})
            </TabsTrigger>
            <TabsTrigger value="filters">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <TabsContent value="review" className="h-full m-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando transações...</p>
            </div>
          ) : transactionsToReview.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Check className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tudo revisado!</h3>
              <p className="text-muted-foreground mb-4">Não há transações pendentes.</p>
              <Button onClick={() => setActiveTab('filters')} variant="outline">
                Alterar Período
              </Button>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Transações</h3>
                    <p className="text-xs text-muted-foreground">
                      {readyCount} prontas • {pendingCount} pendentes
                    </p>
                  </div>
                  <Badge variant="secondary">{transactionsToReview.length}</Badge>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <TransactionReviewTable
                    transactions={transactionsToReview} 
                    accounts={accounts} 
                    categories={categories}
                    investments={investments} 
                    loans={loans} 
                    onUpdateTransaction={handleUpdateTransaction} 
                    onCreateRule={handleCreateRule}
                    compact
                  />
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t bg-white dark:bg-gray-900 sticky bottom-0">
                <Button 
                  onClick={handleContabilize} 
                  disabled={readyCount === 0}
                  className="w-full h-12"
                  size="lg"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Contabilizar {readyCount} itens
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="filters" className="h-full m-0 p-4 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Período da Revisão</h3>
              <div className="space-y-3">
                {quickPeriodOptions.map((option) => (
                  <Button
                    key={option.days}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleQuickPeriodSelect(option.days)}
                  >
                    <Calendar className="w-4 h-4 mr-3" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Período Personalizado</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Data inicial</label>
                  <input
                    type="date"
                    value={reviewRange.from?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setReviewRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Data final</label>
                  <input
                    type="date"
                    value={reviewRange.to?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setReviewRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Resumo</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>Total de transações</span>
                  <span className="font-semibold">{transactionsToReview.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-blue-700 dark:text-blue-300">Prontas para contabilizar</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">{readyCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="text-amber-700 dark:text-amber-300">Pendentes</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{pendingCount}</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => {
                loadTransactions();
                setActiveTab('review');
              }}
              className="w-full"
            >
              Aplicar Filtros
            </Button>
          </div>
        </TabsContent>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Dialog */}
      <Dialog open={open && !isMobile} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 overflow-hidden rounded-xl border">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Painel de Revisão de Extratos</DialogTitle>
                  <DialogDescription className="text-sm">
                    {account?.name} • {importedStatements.filter(s => s.accountId === accountId).length} extratos importados
                  </DialogDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onOpenChange(false)}
                className="h-9 w-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          {renderDesktopLayout()}
        </DialogContent>
      </Dialog>

      {/* Mobile Full-screen View */}
      {isMobile && open && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in">
          {renderMobileLayout()}
        </div>
      )}

      {/* Modals */}
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