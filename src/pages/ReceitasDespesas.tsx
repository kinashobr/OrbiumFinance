"use client";

import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tags, Plus, CalendarCheck, Receipt, Sparkles, Filter, LayoutDashboard, FileUp, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { isWithinInterval, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, addMonths, format } from "date-fns";

// Types
import { ContaCorrente, Categoria, TransacaoCompleta, TransferGroup, AccountSummary, OperationType, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, generateTransactionId, formatCurrency, generateTransferGroupId, DateRange, ComparisonDateRanges, TransactionLinks, StandardizationRule } from "@/types/finance";

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
  const [accountToManage, setAccountToManage] = useState<ContaCorrente | null>(null);

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

  const handleImportExtrato = (accountId?: string) => {
    const account = accountId ? accounts.find(a => a.id === accountId) : null;
    setAccountToManage(account || null);
    setShowStatementManagerModal(true);
  };

  const handleStartConsolidatedReview = (accountId: string) => {
    setAccountForConsolidatedReview(accountId);
    setShowConsolidatedReview(true);
  };

  const handleManageRules = () => {
    setShowStatementManagerModal(false);
    setShowRuleManagerModal(true);
  };

  const handleTransactionSubmit = (transaction: TransacaoCompleta, transferGroup?: TransferGroup) => {
    const tx: TransacaoCompleta = {
      ...transaction,
      links: {
        investmentId: transaction.links.investmentId || null,
        loanId: transaction.links.loanId || null,
        transferGroupId: transaction.links.transferGroupId || null,
        parcelaId: transaction.links.parcelaId || null,
        vehicleTransactionId: transaction.links.vehicleTransactionId || null
      }
    };

    if (editingTransaction) {
      const linkedGroupId = editingTransaction.links?.transferGroupId;

      // Reversal logic
      if (editingTransaction.links?.vehicleTransactionId && editingTransaction.links.vehicleTransactionId !== tx.links.vehicleTransactionId) {
        const [oldSeguroIdStr, oldParcelaNumStr] = editingTransaction.links.vehicleTransactionId.split('_');
        const oldSeguroId = parseInt(oldSeguroIdStr);
        const oldParcelaNumero = parseInt(oldParcelaNumStr);
        if (!isNaN(oldSeguroId) && !isNaN(oldParcelaNumero)) unmarkSeguroParcelPaid(oldSeguroId, oldParcelaNumero);
      }

      if (editingTransaction.links?.loanId && editingTransaction.links.loanId !== tx.links.loanId) {
        const oldLoanIdNum = parseInt(editingTransaction.links.loanId.replace('loan_', ''));
        if (!isNaN(oldLoanIdNum)) unmarkLoanParcelPaid(oldLoanIdNum);
      }

      // Application logic
      if (tx.links?.vehicleTransactionId && tx.flow === 'out') {
        const [seguroIdStr, parcelaNumeroStr] = tx.links.vehicleTransactionId.split('_');
        const seguroId = parseInt(seguroIdStr);
        const parcelaNumero = parseInt(parcelaNumeroStr);
        if (!isNaN(seguroId) && !isNaN(parcelaNumero)) markSeguroParcelPaid(seguroId, parcelaNumero, tx.id);
      }

      if (tx.operationType === 'pagamento_emprestimo' && tx.links?.loanId) {
        const loanIdNum = parseInt(tx.links.loanId.replace('loan_', ''));
        const parcelaNum = tx.links.parcelaId ? parseInt(tx.links.parcelaId) : undefined;
        if (!isNaN(loanIdNum)) markLoanParcelPaid(loanIdNum, tx.amount, tx.date, parcelaNum);
      }

      if (linkedGroupId) {
        setTransacoesV2(prev => prev.map(t => {
          if (t.id === tx.id) return tx;
          if (t.links?.transferGroupId === linkedGroupId && t.id !== tx.id) {
            const updatedLinks: TransactionLinks = {
              investmentId: t.links.investmentId || null,
              loanId: t.links.loanId || null,
              transferGroupId: t.links.transferGroupId || null,
              parcelaId: t.links.parcelaId || null,
              vehicleTransactionId: t.links.vehicleTransactionId || null
            };
            return {
              ...t,
              amount: tx.amount,
              date: tx.date,
              description: tx.description,
              flow: t.accountId === transferGroup?.fromAccountId ? 'transfer_out' : 'transfer_in',
              links: updatedLinks
            } as TransacaoCompleta;
          }
          return t;
        }));
      } else {
        setTransacoesV2(prev => prev.map(t => t.id === tx.id ? tx : t));
      }
      return;
    }

    const newTransactions: TransacaoCompleta[] = [];
    const baseTx = { ...tx, links: { ...(tx.links || {}) } };

    if (transferGroup) {
      const tg = transferGroup;
      const fromAccount = accounts.find(a => a.id === tg.fromAccountId);
      const toAccount = accounts.find(a => a.id === tg.toAccountId);
      const isCreditCard = toAccount?.accountType === 'cartao_credito';
      const originalTx: TransacaoCompleta = {
        ...baseTx,
        id: generateTransactionId(),
        links: {
          investmentId: baseTx.links.investmentId || null,
          loanId: baseTx.links.loanId || null,
          transferGroupId: tg.id,
          parcelaId: baseTx.links.parcelaId || null,
          vehicleTransactionId: baseTx.links.vehicleTransactionId || null
        }
      };
      if (isCreditCard) {
        const ccTx: TransacaoCompleta = {
          ...originalTx,
          accountId: tg.toAccountId,
          flow: 'in' as const,
          operationType: 'transferencia' as const,
          description: tg.description || `Pagamento de fatura CC ${toAccount?.name}`,
        };
        const fromTx: TransacaoCompleta = {
          ...originalTx,
          id: generateTransactionId(),
          accountId: tg.fromAccountId,
          flow: 'transfer_out' as const,
          operationType: 'transferencia' as const,
          description: tg.description || `Pagamento fatura ${toAccount?.name}`,
        };
        newTransactions.push(fromTx, ccTx);
      } else {
        const outTx: TransacaoCompleta = {
          ...originalTx,
          id: generateTransactionId(),
          accountId: tg.fromAccountId,
          flow: 'transfer_out' as const,
          operationType: 'transferencia' as const,
          description: tg.description || `Transferência para ${toAccount?.name}`,
        };
        const inTx: TransacaoCompleta = {
          ...originalTx,
          id: generateTransactionId(),
          accountId: tg.toAccountId,
          flow: 'transfer_in' as const,
          operationType: 'transferencia' as const,
          description: tg.description || `Transferência recebida de ${fromAccount?.name}`,
        };
        newTransactions.push(outTx, inTx);
      }
    } else {
      const simpleTx: TransacaoCompleta = {
        ...baseTx,
        id: tx.id || generateTransactionId(),
        links: {
          investmentId: baseTx.links.investmentId || null,
          loanId: baseTx.links.loanId || null,
          transferGroupId: baseTx.links.transferGroupId || null,
          parcelaId: baseTx.links.parcelaId || null,
          vehicleTransactionId: baseTx.links.vehicleTransactionId || null
        }
      };
      newTransactions.push(simpleTx);
    }

    const isInvestmentFlow = (baseTx.operationType === 'aplicacao' || baseTx.operationType === 'resgate') && baseTx.links?.investmentId;
    if (isInvestmentFlow) {
      const isAplicacao = baseTx.operationType === 'aplicacao';
      const groupId = isAplicacao ? `app_${Date.now()}` : `res_${Date.now()}`;
      const primaryTx = newTransactions.find(t => t.id === baseTx.id) || newTransactions[0];
      primaryTx.links.transferGroupId = groupId;
      primaryTx.flow = isAplicacao ? 'out' : 'in';
      primaryTx.operationType = isAplicacao ? 'aplicacao' : 'resgate';
      primaryTx.domain = 'investment';
      const secondaryTx: TransacaoCompleta = {
        ...primaryTx,
        id: generateTransactionId(),
        accountId: baseTx.links.investmentId!,
        flow: isAplicacao ? 'in' : 'out',
        operationType: isAplicacao ? 'aplicacao' : 'resgate',
        domain: 'investment',
        description: isAplicacao ? baseTx.description || `Aplicação recebida` : baseTx.description || `Resgate enviado`,
        links: {
          investmentId: primaryTx.accountId,
          loanId: primaryTx.links.loanId || null,
          transferGroupId: groupId,
          parcelaId: primaryTx.links.parcelaId || null,
          vehicleTransactionId: primaryTx.links.vehicleTransactionId || null
        }
      };
      if (!newTransactions.some(t => t.id === secondaryTx.id)) newTransactions.push(secondaryTx);
    }

    const finalTx = newTransactions.find(t => t.id === tx.id) || newTransactions[0];
    if (finalTx.operationType === 'liberacao_emprestimo' && finalTx.meta?.numeroContrato) {
      addEmprestimo({
        contrato: finalTx.meta.numeroContrato,
        valorTotal: finalTx.amount,
        parcela: 0,
        meses: 0,
        taxaMensal: 0,
        status: 'pendente_config',
        liberacaoTransactionId: finalTx.id,
        contaCorrenteId: finalTx.accountId,
        dataInicio: finalTx.date
      });
    }
    if (finalTx.operationType === 'pagamento_emprestimo' && finalTx.links?.loanId) {
      const loanIdNum = parseInt(finalTx.links.loanId.replace('loan_', ''));
      const parcelaNum = finalTx.links.parcelaId ? parseInt(finalTx.links.parcelaId) : undefined;
      if (!isNaN(loanIdNum)) markLoanParcelPaid(loanIdNum, finalTx.amount, finalTx.date, parcelaNum);
    }
    if (finalTx.links?.vehicleTransactionId && finalTx.flow === 'out') {
      const [seguroIdStr, parcelaNumeroStr] = finalTx.links.vehicleTransactionId.split('_');
      const seguroId = parseInt(seguroIdStr);
      const parcelaNumero = parseInt(parcelaNumeroStr);
      if (!isNaN(seguroId) && !isNaN(parcelaNumero)) markSeguroParcelPaid(seguroId, parcelaNumero, finalTx.id);
    }
    if (finalTx.operationType === 'veiculo' && finalTx.meta?.vehicleOperation === 'compra') {
      addVeiculo({
        modelo: finalTx.description,
        marca: '',
        tipo: finalTx.meta.tipoVeiculo || 'carro',
        ano: 0,
        dataCompra: finalTx.date,
        valorVeiculo: finalTx.amount,
        valorSeguro: 0,
        vencimentoSeguro: "",
        parcelaSeguro: 0,
        valorFipe: 0,
        compraTransactionId: finalTx.id,
        status: 'pendente_cadastro'
      });
    }
    newTransactions.forEach(t => addTransacaoV2(t));
  };

  const handleEditTransaction = (transaction: TransacaoCompleta) => {
    setEditingTransaction(transaction);
    setSelectedAccountForModal(transaction.accountId);
    setShowMovimentarModal(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta transação?")) return;
    const transactionToDelete = transactions.find(t => t.id === id);
    if (transactionToDelete?.operationType === 'pagamento_emprestimo' && transactionToDelete.links?.loanId) {
      const loanIdNum = parseInt(transactionToDelete.links.loanId.replace('loan_', ''));
      if (!isNaN(loanIdNum)) unmarkLoanParcelPaid(loanIdNum);
    }
    if (transactionToDelete?.links?.vehicleTransactionId && transactionToDelete.flow === 'out') {
      const [seguroIdStr, parcelaNumStr] = transactionToDelete.links.vehicleTransactionId.split('_');
      const seguroId = parseInt(seguroIdStr);
      const parcelaNumero = parseInt(parcelaNumStr);
      if (!isNaN(seguroId) && !isNaN(parcelaNumero)) unmarkSeguroParcelPaid(seguroId, parcelaNumero);
    }
    if (transactionToDelete?.operationType === 'veiculo' && transactionToDelete.meta?.vehicleOperation === 'compra') {
      const vehicleId = veiculos.find(v => v.compraTransactionId === id)?.id;
      if (vehicleId) {
        const vehicle = veiculos.find(v => v.id === vehicleId);
        if (vehicle?.status === 'pendente_cadastro') deleteVeiculo(vehicleId);
      }
    }
    if (transactionToDelete?.meta.source === 'import') uncontabilizeImportedTransaction(id);
    const linkedGroupId = transactionToDelete?.links?.transferGroupId;
    if (linkedGroupId) {
      setTransacoesV2(prev => prev.filter(t => t.links?.transferGroupId !== linkedGroupId));
      toast.success("Transações vinculadas excluídas");
    } else {
      setTransacoesV2(prev => prev.filter(t => t.id !== id));
      toast.success("Transação excluída");
    }
  };

  const handleToggleConciliated = (id: string, value: boolean) => {
    setTransacoesV2(prev => prev.map(t => t.id === id ? { ...t, conciliated: value } : t));
  };

  const handleAccountSubmit = (account: ContaCorrente, initialBalanceValue: number) => {
    const isNewAccount = !editingAccount;
    const initialBalanceAmount = initialBalanceValue ?? 0;
    const newAccount: ContaCorrente = { ...account, initialBalance: 0 };
    if (isNewAccount) {
      setContasMovimento(prev => [...prev, newAccount]);
      if (initialBalanceAmount !== 0) {
        addTransacaoV2({
          id: generateTransactionId(),
          date: account.startDate!,
          accountId: account.id,
          flow: initialBalanceAmount >= 0 ? 'in' : 'out',
          operationType: 'initial_balance',
          domain: 'operational',
          amount: Math.abs(initialBalanceAmount),
          categoryId: null,
          description: `Saldo Inicial de Implantação`,
          links: { investmentId: null, loanId: null, transferGroupId: null, parcelaId: null, vehicleTransactionId: null },
          conciliated: true,
          attachments: [],
          meta: { createdBy: 'user', source: 'manual', createdAt: new Date().toISOString() }
        });
      }
    } else {
      setContasMovimento(prev => prev.map(a => a.id === newAccount.id ? newAccount : a));
    }
    setEditingAccount(undefined);
  };

  const handleAccountDelete = (accountId: string) => {
    if (transactions.some(t => t.accountId === accountId)) {
      toast.error("Não é possível excluir conta com transações vinculadas");
      return;
    }
    setContasMovimento(prev => prev.filter(a => a.id !== accountId));
    setTransacoesV2(prev => prev.filter(t => t.accountId !== accountId));
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
          {/* Accounts Section - Modular */}
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
                  onClick={() => setShowAccountModal(true)}
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

            {/* Reconciliation / Smart Area Placeholder */}
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
                    onClick={() => handleImportExtrato()}
                  >
                    <FileUp className="w-4 h-4" />
                    Importar Extrato
                  </Button>
                  <Button 
                    variant="outline"
                    className="bg-transparent text-white border-white/20 rounded-full px-6 font-bold h-10 hover:bg-white/10 transition-colors gap-2"
                    onClick={() => setShowRuleManagerModal(true)}
                  >
                    <Settings2 className="w-4 h-4" />
                    Regras
                  </Button>
                </div>
              </div>
              <div className="hidden sm:flex z-10 w-24 h-24 rounded-full border-4 border-white/10 items-center justify-center bg-white/5 backdrop-blur-sm">
                <RefreshCw className="w-10 h-10 text-primary-foreground/40 group-hover:rotate-180 transition-transform duration-1000" />
              </div>
            </div>
          </div>

          {/* Indicators Section - Vertical Sidebar */}
          <div className="col-span-12 lg:col-span-4">
             <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 h-full">
                <KPISidebar transactions={transacoesPeriodo1} categories={categories} />
             </div>
          </div>
        </div>
      </div>

      {/* Modais mantidos conforme lógica anterior */}
      <MovimentarContaModal open={showMovimentarModal} onOpenChange={setShowMovimentarModal} accounts={accounts} categories={categories} investments={investments} loans={loans} segurosVeiculo={segurosVeiculo} veiculos={veiculos} selectedAccountId={selectedAccountForModal} onSubmit={handleTransactionSubmit} editingTransaction={editingTransaction} />
      <AccountFormModal open={showAccountModal} onOpenChange={setShowAccountModal} account={editingAccount} onSubmit={handleAccountSubmit} onDelete={handleAccountDelete} hasTransactions={editingAccount ? transactions.some(t => t.accountId === editingAccount.id) : false} />
      <CategoryFormModal open={showCategoryModal} onOpenChange={setShowCategoryModal} category={editingCategory} onSubmit={handleCategorySubmit} onDelete={handleCategoryDelete} hasTransactions={editingCategory ? transactions.some(t => t.categoryId === editingCategory.id) : false} />
      <CategoryListModal open={showCategoryListModal} onOpenChange={setShowCategoryListModal} categories={categories} onAddCategory={() => { setEditingCategory(undefined); setShowCategoryModal(true); }} onEditCategory={cat => { setEditingCategory(cat); setShowCategoryModal(true); }} onDeleteCategory={handleCategoryDelete} transactionCountByCategory={transactionCountByCategory} />
      {viewingAccount && viewingSummary && <AccountStatementDialog open={showStatementDialog} onOpenChange={setShowStatementDialog} account={viewingAccount} accountSummary={viewingSummary} transactions={viewingTransactions} categories={categories} onEditTransaction={handleEditTransaction} onDeleteTransaction={handleDeleteTransaction} onToggleConciliated={handleToggleConciliated} onReconcileAll={() => handleReconcile(viewingAccountId!)} />}
      <BillsTrackerModal open={showBillsTrackerModal} onOpenChange={setShowBillsTrackerModal} />
      {showStatementManagerModal && <StatementManagerDialog open={showStatementManagerModal} onOpenChange={setShowStatementManagerModal} account={accountToManage || accounts.find(a => a.accountType === 'corrente')!} investments={investments} loans={loans} onStartConsolidatedReview={handleStartConsolidatedReview} onManageRules={handleManageRules} />}
      {accountForConsolidatedReview && <ConsolidatedReviewDialog open={showConsolidatedReview} onOpenChange={setShowConsolidatedReview} accountId={accountForConsolidatedReview} accounts={accounts} categories={categories} investments={investments} loans={loans} />}
      <StandardizationRuleManagerModal open={showRuleManagerModal} onOpenChange={setShowRuleManagerModal} rules={standardizationRules} onDeleteRule={deleteStandardizationRule} categories={categories} />
    </MainLayout>
  );
};

export default ReceitasDespesas;
</dyad-file>

<dyad-write path="src/components/transactions/StatementManagerDialog.tsx" description="Atualizando para o estilo Material Expressive 3 e adicionando seletor de conta.">
import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Check, X, Loader2, AlertCircle, Pin, Car, Eye, Trash2, Wallet, ArrowRight, Settings2 } from "lucide-react";
import { 
  ContaCorrente, ImportedStatement, ImportedTransaction, 
  formatCurrency, generateStatementId, AccountType, ACCOUNT_TYPE_LABELS
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Interface simplificada para Empréstimo
interface LoanInfo {
  id: string;
  institution: string;
  numeroContrato?: string;
}

// Interface simplificada para Investimento
interface InvestmentInfo {
  id: string;
  name: string;
}

interface StatementManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ContaCorrente | null;
  investments: InvestmentInfo[];
  loans: LoanInfo[];
  onStartConsolidatedReview: (accountId: string) => void;
  onManageRules: () => void;
}

export function StatementManagerDialog({ open, onOpenChange, account, investments, loans, onStartConsolidatedReview, onManageRules }: StatementManagerDialogProps) {
  const { 
    importedStatements, 
    processStatementFile, 
    deleteImportedStatement,
    contasMovimento
  } = useFinance();
  
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Estado para a conta selecionada (inicializado com a conta passada via props)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(account?.id || '');

  // Atualiza se a conta externa mudar
  useEffect(() => {
    if (account) {
      setSelectedAccountId(account.id);
    } else if (contasMovimento.length > 0 && !selectedAccountId) {
      const firstChecking = contasMovimento.find(c => c.accountType === 'corrente');
      if (firstChecking) setSelectedAccountId(firstChecking.id);
    }
  }, [account, contasMovimento]);

  const selectedAccount = useMemo(() => 
    contasMovimento.find(a => a.id === selectedAccountId), 
    [contasMovimento, selectedAccountId]
  );
  
  // Filtra extratos pertencentes à conta selecionada
  const statementsForAccount = useMemo(() => {
    return importedStatements.filter(s => s.accountId === selectedAccountId);
  }, [importedStatements, selectedAccountId]);

  const availableAccounts = useMemo(() => 
    contasMovimento.filter(a => a.accountType === 'corrente' || a.accountType === 'cartao_credito'), 
    [contasMovimento]
  );

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
        const fileName = selectedFile.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.ofx')) {
            setError("Formato de arquivo inválido. Use .csv ou .ofx.");
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    handleFileSelect(selectedFile || null);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione um arquivo para importar.");
      return;
    }

    if (!selectedAccountId) {
      setError("Selecione uma conta para atribuir este extrato.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await processStatementFile(file, selectedAccountId);
      
      if (result.success) {
        toast.success(result.message);
        setFile(null);
      } else {
        setError(result.message);
      }
      
    } catch (e: any) {
      console.error("Parsing Error:", e);
      setError(e.message || "Erro ao processar o arquivo. Verifique o formato.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteStatement = (statementId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este extrato? Todas as transações brutas não contabilizadas serão perdidas.")) {
        deleteImportedStatement(statementId);
        toast.success("Extrato excluído.");
    }
  };
  
  const handleStartReview = () => {
    if (!selectedAccountId) return;
    if (statementsForAccount.length === 0) {
        toast.error("Importe pelo menos um extrato para iniciar a revisão.");
        return;
    }
    onOpenChange(false);
    onStartConsolidatedReview(selectedAccountId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-card rounded-[2.5rem]">
        <DialogHeader className="shrink-0 px-8 pt-8 pb-6 bg-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <FileText className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold tracking-tight">Central de Importação</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Atribua o extrato bancário a uma conta movimento e inicie a conciliação automática.
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 mt-6">
          
          {/* Seletor de Conta Expressivo */}
          <div className="space-y-3">
            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Conta Movimento Destino</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-14 bg-muted/50 border-border/40 rounded-2xl px-5 hover:bg-muted transition-colors">
                <SelectValue placeholder="Selecione a conta...">
                    {selectedAccount && (
                        <div className="flex items-center gap-3">
                            <Wallet className="w-4 h-4 text-primary" />
                            <span className="font-bold text-foreground">{selectedAccount.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">{ACCOUNT_TYPE_LABELS[selectedAccount.accountType]}</Badge>
                        </div>
                    )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40">
                {availableAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="rounded-xl py-2.5">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-4 h-4 text-primary/70" />
                        <div>
                            <p className="font-bold text-sm leading-none">{a.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{ACCOUNT_TYPE_LABELS[a.accountType]}</p>
                        </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload AreaExpressiva */}
          <div 
            className={cn(
                "p-8 border-2 border-dashed rounded-[2rem] text-center space-y-4 transition-all group",
                isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/40 bg-muted/20"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            
            <div className="space-y-1">
              <p className="font-bold text-foreground">Arraste seu extrato aqui</p>
              <p className="text-xs text-muted-foreground">Arquivos suportados: .csv ou .ofx (Padrão Bancário)</p>
            </div>

            <Input 
              type="file" 
              accept=".csv,.ofx" 
              onChange={handleFileChange} 
              className="hidden" 
              id="file-upload"
            />
            
            <div className="flex flex-col items-center gap-4">
                <Label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-wider h-10 px-6 bg-white dark:bg-neutral-800 text-foreground border border-border/60 shadow-sm hover:bg-muted transition-colors">
                  {file ? file.name : "Selecionar do Computador"}
                </Label>
                
                {error && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 animate-in fade-in zoom-in duration-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </div>
                )}
                
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || loading} 
                  className="w-full h-12 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {loading ? "Processando Extrato..." : "Carregar para Revisão"}
                </Button>
            </div>
          </div>
          
          {/* Lista de Extratos Expressiva */}
          <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-foreground">Extratos Carregados</h3>
                    <Badge className="bg-muted text-muted-foreground border-none font-bold">{statementsForAccount.length}</Badge>
                  </div>
                  <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-black uppercase tracking-widest text-primary gap-1.5 rounded-full px-4 hover:bg-primary/5"
                      onClick={onManageRules}
                  >
                      <Settings2 className="w-3.5 h-3.5" />
                      Regras de Padronização
                  </Button>
              </div>
              
              <div className="rounded-[2rem] border border-border/40 overflow-hidden bg-muted/10">
                <ScrollArea className="h-[280px]">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border/30">
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-6">Arquivo</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Transações</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Status</TableHead>
                                <TableHead className="text-right px-6"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {statementsForAccount.map(stmt => {
                                const pendingCount = stmt.rawTransactions.filter(t => !t.isContabilized).length;
                                const totalCount = stmt.rawTransactions.length;
                                const isComplete = stmt.status === 'complete';
                                
                                return (
                                    <TableRow key={stmt.id} className="border-border/20 hover:bg-muted/20 transition-colors">
                                        <TableCell className="px-6 py-4">
                                            <p className="text-sm font-bold text-foreground truncate max-w-[200px]" title={stmt.fileName}>
                                                {stmt.fileName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {format(parseDateLocal(stmt.startDate), 'dd/MM')} a {format(parseDateLocal(stmt.endDate), 'dd/MM/yy')}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm font-black tabular-nums">{pendingCount} <span className="text-[10px] font-bold text-muted-foreground uppercase">Pendentes</span></p>
                                            <p className="text-[10px] text-muted-foreground">{totalCount} no total</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] font-black uppercase tracking-tight border-none px-3",
                                                isComplete ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                            )}>
                                                {isComplete ? 'Conciliado' : 'A Revisar'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteStatement(stmt.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {statementsForAccount.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-16 opacity-40">
                                        <FileText className="w-12 h-12 mx-auto mb-3" />
                                        <p className="text-sm font-bold uppercase tracking-widest">Nenhum extrato para esta conta</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
              </div>
          </div>
          
          {/* Botão de Revisão Consolidada Expressivo */}
          <div className="pt-4">
              <Button 
                  onClick={handleStartReview} 
                  disabled={statementsForAccount.length === 0}
                  className="w-full h-16 bg-accent text-white rounded-[1.75rem] font-black text-lg shadow-xl shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all gap-4 group"
              >
                  <Eye className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  REVISAR LANÇAMENTOS
                  <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-2 transition-transform" />
              </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}