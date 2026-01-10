"use client";

import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tags, Plus, CalendarCheck, Receipt, Sparkles, Filter, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { isWithinInterval, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, addMonths, format } from "date-fns";

// Types
import { ContaCorrente, Categoria, TransacaoCompleta, TransferGroup, AccountSummary, OperationType, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, generateTransactionId, formatCurrency, generateTransferGroupId, DateRange, ComparisonDateRanges, TransactionLinks } from "@/types/finance";

// Components
import { AccountsCarousel } from "@/components/transactions/AccountsCarousel";
import { MovimentarContaModal } from "@/components/transactions/MovimentarContaModal";
import { KPISidebar } from "@/components/transactions/KPISidebar";
import { AccountFormModal } from "@/components/transactions/AccountFormModal";
import { CategoryFormModal } from "@/components/transactions/CategoryFormModal";
import { CategoryListModal } from "@/components/transactions/CategoryListModal";
import { AccountStatementDialog } from "@/components/transactions/AccountStatementDialog";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { BillsTrackerModal } from "@/components/bills/BillsTrackerModal";
import { StatementManagerDialog } from "@/components/transactions/StatementManagerDialog";
import { ConsolidatedReviewDialog } from "@/components/transactions/ConsolidatedReviewDialog";
import { StandardizationRuleManagerModal } from "@/components/transactions/StandardizationRuleManagerModal";

// Context
import { useFinance } from "@/contexts/FinanceContext";
import { parseDateLocal, cn } from "@/lib/utils";

const ReceitasDespesas = () => {
  const {
    contasMovimento,
    setContasMovimento,
    categoriasV2: categories,
    setCategoriasV2,
    transacoesV2,
    setTransacoesV2,
    addTransacaoV2,
    emprestimos,
    addEmprestimo,
    markLoanParcelPaid,
    unmarkLoanParcelPaid,
    veiculos,
    addVeiculo,
    deleteVeiculo,
    calculateBalanceUpToDate,
    dateRanges,
    setDateRanges,
    markSeguroParcelPaid,
    unmarkSeguroParcelPaid,
    standardizationRules,
    deleteStandardizationRule,
    uncontabilizeImportedTransaction,
    segurosVeiculo 
  } = useFinance();

  // UI state
  const [showMovimentarModal, setShowMovimentarModal] = useState(false);
  const [selectedAccountForModal, setSelectedAccountForModal] = useState<string>();

  // Modals state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ContaCorrente>();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryListModal, setShowCategoryListModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Categoria>();
  const [editingTransaction, setEditingTransaction] = useState<TransacaoCompleta>();

  // Statement dialog
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null);
  const [showStatementDialog, setShowStatementDialog] = useState(false);

  // Bills Tracker Modal
  const [showBillsTrackerModal, setShowBillsTrackerModal] = useState(false);

  // Import Modal State
  const [showStatementManagerModal, setShowStatementManagerModal] = useState(false);
  const [accountToManageId, setAccountToManageId] = useState<string | null>(null);

  // Consolidated Review
  const [showConsolidatedReview, setShowConsolidatedReview] = useState(false);
  const [accountForConsolidatedReview, setAccountForConsolidatedReview] = useState<string | null>(null);

  // Standardization Rule Manager
  const [showRuleManagerModal, setShowRuleManagerModal] = useState(false);

  const accounts = contasMovimento;
  const transactions = transacoesV2;

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const filterTransactionsByRange = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return transacoesV2;
    const rangeFrom = startOfDay(range.from);
    const rangeTo = endOfDay(range.to);
    return transacoesV2.filter(t => {
      const transactionDate = parseDateLocal(t.date);
      return isWithinInterval(transactionDate, { start: rangeFrom, end: rangeTo });
    });
  }, [transacoesV2]);

  const transacoesPeriodo1 = useMemo(() => filterTransactionsByRange(dateRanges.range1), [filterTransactionsByRange, dateRanges.range1]);

  const visibleAccounts = useMemo(() => accounts.filter(a => !a.hidden), [accounts]);

  const accountSummaries: AccountSummary[] = useMemo(() => {
    const periodStart = dateRanges.range1.from;
    const periodEnd = dateRanges.range1.to;
    return visibleAccounts.map(account => {
      let periodInitialBalance = 0;
      if (periodStart) {
        const dayBeforeStart = subDays(periodStart, 1);
        periodInitialBalance = calculateBalanceUpToDate(account.id, dayBeforeStart, transactions, accounts);
      }
      const accountTxInPeriod = transactions.filter(t => {
        if (t.accountId !== account.id) return false;
        const transactionDate = parseDateLocal(t.date);
        const rangeFrom = periodStart ? startOfDay(periodStart) : undefined;
        const rangeTo = periodEnd ? endOfDay(periodEnd) : undefined;
        if (!rangeFrom) return true;
        return transactionDate >= rangeFrom && transactionDate <= (rangeTo || new Date());
      });
      let totalIn = 0;
      let totalOut = 0;
      accountTxInPeriod.forEach(t => {
        const isCreditCard = account.accountType === 'cartao_credito';
        if (isCreditCard) {
          if (t.operationType === 'despesa') totalOut += t.amount;
          else if (t.operationType === 'transferencia') totalIn += t.amount;
        } else {
          if (t.flow === 'in' || t.flow === 'transfer_in') totalIn += t.amount;
          else totalOut += t.amount;
        }
      });
      const periodFinalBalance = periodInitialBalance + totalIn - totalOut;
      const conciliatedCount = accountTxInPeriod.filter(t => t.conciliated).length;
      const reconciliationStatus = accountTxInPeriod.length === 0 || conciliatedCount === accountTxInPeriod.length ? 'ok' : 'warning' as const;
      return {
        accountId: account.id,
        accountName: account.name,
        accountType: account.accountType,
        institution: account.institution,
        initialBalance: periodInitialBalance,
        currentBalance: periodFinalBalance,
        projectedBalance: periodFinalBalance,
        totalIn,
        totalOut,
        reconciliationStatus,
        transactionCount: accountTxInPeriod.length
      };
    });
  }, [visibleAccounts, transactions, dateRanges, calculateBalanceUpToDate, accounts]);

  const handleMovimentar = (accountId: string) => {
    setSelectedAccountForModal(accountId);
    setEditingTransaction(undefined);
    setShowMovimentarModal(true);
  };

  const handleViewStatement = (accountId: string) => {
    setViewingAccountId(accountId);
    setShowStatementDialog(true);
  };

  const handleImportExtrato = (accountId: string | null) => {
    setAccountToManageId(accountId);
    setShowStatementManagerModal(true);
  };

  const handleStartConsolidatedReview = (accountId: string) => {
    setAccountForConsolidatedReview(accountId);
    setShowConsolidatedReview(true);
  };

  const handleTransactionSubmit = (transaction: TransacaoCompleta, transferGroup?: TransferGroup) => {
    if (editingTransaction) {
       setTransacoesV2(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    } else {
       addTransacaoV2(transaction);
    }
  };

  const handleEditTransaction = (transaction: TransacaoCompleta) => {
    setEditingTransaction(transaction);
    setSelectedAccountForModal(transaction.accountId);
    setShowMovimentarModal(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta transação?")) return;
    setTransacoesV2(prev => prev.filter(t => t.id !== id));
    toast.success("Transação excluída");
  };

  const handleToggleConciliated = (id: string, value: boolean) => {
    setTransacoesV2(prev => prev.map(t => t.id === id ? { ...t, conciliated: value } : t));
  };

  const handleAccountSubmit = (account: ContaCorrente, initialBalanceValue: number) => {
    const isNewAccount = !editingAccount;
    if (isNewAccount) {
      setContasMovimento(prev => [...prev, account]);
      if (initialBalanceValue !== 0) {
        addTransacaoV2({
          id: generateTransactionId(),
          date: account.startDate!,
          accountId: account.id,
          flow: initialBalanceValue >= 0 ? 'in' : 'out',
          operationType: 'initial_balance',
          domain: 'operational',
          amount: Math.abs(initialBalanceValue),
          categoryId: null,
          description: `Saldo Inicial de Implantação`,
          links: { investmentId: null, loanId: null, transferGroupId: null, parcelaId: null, vehicleTransactionId: null },
          conciliated: true,
          attachments: [],
          meta: { createdBy: 'user', source: 'manual', createdAt: new Date().toISOString() }
        });
      }
    } else {
      setContasMovimento(prev => prev.map(a => a.id === account.id ? account : a));
    }
    setEditingAccount(undefined);
  };

  const handleAccountDelete = (accountId: string) => {
    setContasMovimento(prev => prev.filter(a => a.id !== accountId));
    toast.success("Conta excluída");
  };

  const handleManageRules = () => {
    setShowRuleManagerModal(true);
  };

  const handleEditAccount = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      const initialTx = transactions.find(t => t.accountId === accountId && t.operationType === 'initial_balance');
      let initialBalanceValue = 0;
      if (initialTx) initialBalanceValue = initialTx.flow === 'in' ? initialTx.amount : -initialTx.amount;
      setEditingAccount({ ...account, initialBalanceValue } as any);
      setShowAccountModal(true);
    }
  };

  const handleCategorySubmit = (category: Categoria) => {
    if (editingCategory) setCategoriasV2(prev => prev.map(c => c.id === category.id ? category : c));
    else setCategoriasV2(prev => [...prev, category]);
    setEditingCategory(undefined);
  };

  const handleCategoryDelete = (categoryId: string) => {
    if (transactions.some(t => t.categoryId === categoryId)) {
      toast.error("Não é possível excluir categoria em uso");
      return;
    }
    setCategoriasV2(prev => prev.filter(c => c.id !== categoryId));
  };

  const investments = useMemo(() => accounts.filter(c => ['renda_fixa', 'poupanca', 'cripto', 'reserva', 'objetivo'].includes(c.accountType)).map(i => ({ id: i.id, name: i.name })), [accounts]);
  const loans = useMemo(() => emprestimos.filter(e => e.status !== 'pendente_config').map(e => {
    const startDate = parseDateLocal(e.dataInicio || new Date().toISOString().split('T')[0]);
    const parcelas = e.meses > 0 ? Array.from({ length: e.meses }, (_, i) => {
      const vencimento = addMonths(startDate, i);
      const paymentTx = transactions.find(t => t.operationType === 'pagamento_emprestimo' && t.links?.loanId === `loan_${e.id}` && t.links?.parcelaId === (i + 1).toString());
      return { numero: i + 1, vencimento: format(vencimento, 'yyyy-MM-dd'), valor: e.parcela, paga: !!paymentTx, transactionId: paymentTx?.id };
    }) : [];
    return { id: `loan_${e.id}`, institution: e.contrato, numeroContrato: e.contrato, parcelas, valorParcela: e.parcela, totalParcelas: e.meses };
  }), [emprestimos, transactions]);

  const viewingAccount = viewingAccountId ? accounts.find(a => a.id === viewingAccountId) : null;
  const viewingSummary = viewingAccountId ? accountSummaries.find(s => s.accountId === viewingAccountId) : null;
  const viewingTransactions = viewingAccountId ? transactions.filter(t => t.accountId === viewingAccountId) : [];

  const transactionCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => { if (t.categoryId) counts[t.categoryId] = (counts[t.categoryId] || 0) + 1; });
    return counts;
  }, [transactions]);

  return (
    <MainLayout>
      <div className="space-y-8 pb-10">
        {/* Header - Orbium Style */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 animate-fade-in">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-lg shadow-primary/20 ring-4 ring-primary/10">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl leading-none tracking-tight">Movimentação</h1>
                <p className="text-xs text-muted-foreground font-medium tracking-wide mt-0.5 uppercase">Gestão Operacional</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="h-10 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm"
            />
          </div>
        </header>

        {/* Action Chips */}
        <section className="flex flex-wrap gap-2 px-1 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Button
            variant="ghost"
            onClick={() => setShowMovimentarModal(true)}
            className="h-10 rounded-full gap-2 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10"
          >
            <Plus className="h-4 w-4" />
            <span className="font-bold text-sm">Novo Lançamento</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBillsTrackerModal(true)}
            className="h-10 rounded-full gap-2 px-5 border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
          >
            <CalendarCheck className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Contas a Pagar</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCategoryListModal(true)}
            className="h-10 rounded-full gap-2 px-5 border-border/40 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
          >
            <Tags className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Categorias</span>
          </Button>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5">
              <div className="flex items-center justify-between mb-6 px-1">
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">Contas Correntes</h3>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Saldos e Disponibilidade</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setEditingAccount(undefined); setShowAccountModal(true); }}
                  className="w-10 h-10 rounded-full bg-primary/5 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              
              <AccountsCarousel
                accounts={accountSummaries}
                onMovimentar={handleMovimentar}
                onViewHistory={handleViewStatement}
                onAddAccount={() => { setEditingAccount(undefined); setShowAccountModal(true); }}
                onEditAccount={handleEditAccount}
                onImportAccount={handleImportExtrato}
                showHeader={false}
              />
            </div>

            {/* Reconciliation Card - M3 Style */}
            <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-[32px] p-8 shadow-lg relative overflow-hidden flex items-center justify-between group">
              <div className="absolute right-0 bottom-0 opacity-10 scale-150 translate-x-10 translate-y-10 group-hover:rotate-12 transition-transform duration-700">
                <Sparkles className="w-[180px] h-[180px]" />
              </div>
              <div className="z-10">
                <h3 className="font-display font-bold text-2xl mb-2">Conciliação Inteligente</h3>
                <p className="text-neutral-400 text-sm max-w-sm">Importe seus extratos OFX ou CSV e deixe o Orbium categorizar tudo automaticamente com base nas suas regras.</p>
                <div className="flex gap-3 mt-6">
                  <Button 
                    className="bg-primary text-primary-foreground rounded-full px-6 font-bold h-10 hover:scale-105 transition-transform gap-2"
                    onClick={() => handleImportExtrato(null)}
                  >
                    <Upload className="w-4 h-4" />
                    Importar Extrato
                  </Button>
                </div>
              </div>
              <div className="hidden sm:flex z-10 w-24 h-24 rounded-full border-4 border-white/10 items-center justify-center bg-white/5 backdrop-blur-sm">
                <RefreshCw className="w-10 h-10 text-primary-foreground/40 group-hover:rotate-180 transition-transform duration-1000" />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
             <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 h-full">
                <KPISidebar transactions={transacoesPeriodo1} categories={categories} />
             </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MovimentarContaModal open={showMovimentarModal} onOpenChange={setShowMovimentarModal} accounts={accounts} categories={categories} investments={investments} loans={loans} segurosVeiculo={segurosVeiculo} veiculos={veiculos} selectedAccountId={selectedAccountForModal} onSubmit={handleTransactionSubmit} editingTransaction={editingTransaction} />
      
      <AccountFormModal open={showAccountModal} onOpenChange={setShowAccountModal} account={editingAccount} onSubmit={handleAccountSubmit} onDelete={handleAccountDelete} hasTransactions={editingAccount ? transactions.some(t => t.accountId === editingAccount.id) : false} />
      
      <CategoryFormModal open={showCategoryModal} onOpenChange={setShowCategoryModal} category={editingCategory} onSubmit={handleCategorySubmit} onDelete={handleCategoryDelete} hasTransactions={editingCategory ? transactions.some(t => t.categoryId === editingCategory.id) : false} />
      
      <CategoryListModal open={showCategoryListModal} onOpenChange={setShowCategoryListModal} categories={categories} onAddCategory={() => { setEditingCategory(undefined); setShowCategoryModal(true); }} onEditCategory={cat => { setEditingCategory(cat); setShowCategoryModal(true); }} onDeleteCategory={handleCategoryDelete} transactionCountByCategory={transactionCountByCategory} />
      
      {viewingAccount && viewingSummary && <AccountStatementDialog open={showStatementDialog} onOpenChange={setShowStatementDialog} account={viewingAccount} accountSummary={viewingSummary} transactions={viewingTransactions} categories={categories} onEditTransaction={handleEditTransaction} onDeleteTransaction={handleDeleteTransaction} onToggleConciliated={handleToggleConciliated} onReconcileAll={() => {}} />}
      
      <BillsTrackerModal open={showBillsTrackerModal} onOpenChange={setShowBillsTrackerModal} />
      
      <StatementManagerDialog 
        open={showStatementManagerModal} 
        onOpenChange={setShowStatementManagerModal} 
        accounts={accounts.filter(a => a.accountType === 'corrente')}
        selectedAccountId={accountToManageId}
        investments={investments} 
        loans={loans} 
        onStartConsolidatedReview={handleStartConsolidatedReview} 
        onManageRules={handleManageRules} 
      />
      
      {accountForConsolidatedReview && <ConsolidatedReviewDialog open={showConsolidatedReview} onOpenChange={setShowConsolidatedReview} accountId={accountForConsolidatedReview} accounts={accounts} categories={categories} investments={investments} loans={loans} />}
      
      <StandardizationRuleManagerModal open={showRuleManagerModal} onOpenChange={setShowRuleManagerModal} rules={standardizationRules} onDeleteRule={deleteStandardizationRule} categories={categories} />
    </MainLayout>
  );
};

export default ReceitasDespesas;