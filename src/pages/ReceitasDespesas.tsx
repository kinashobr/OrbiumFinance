"use client";

import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tags, Plus, CalendarCheck, Receipt, Sparkles, Filter, LayoutDashboard } from "lucide-react";
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

  const handleReconcile = useCallback((accountId: string) => {
    setTransacoesV2(prev => prev.map(t => 
      t.accountId === accountId ? { ...t, conciliated: true } : t
    ));
    toast.success(`Todas as transações da conta ${accounts.find(a => a.id === accountId)?.name || accountId} foram conciliadas.`);
  }, [setTransacoesV2, accounts]);

  const handleMovimentar = (accountId: string) => {
    setSelectedAccountForModal(accountId);
    setEditingTransaction(undefined);
    setShowMovimentarModal(true);
  };

  const handleViewStatement = (accountId: string) => {
    setViewingAccountId(accountId);
    setShowStatementDialog(true);
  };

  const handleImportExtrato = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account && account.accountType === 'corrente') {
      setAccountToManage(account);
      setShowStatementManagerModal(true);
    } else {
      toast.error("A importação de extrato é permitida apenas para Contas Correntes.");
    }
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
        },
        meta: { ...primaryTx.meta, createdBy: 'system' },
        conciliated: false,
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
                    className="bg-primary text-primary-foreground rounded-full px-6 font-bold h-10 hover:scale-105 transition-transform"
                    onClick={() => setShowRuleManagerModal(true)}
                  >
                    Gerenciar Regras
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
      {accountToManage && <StatementManagerDialog open={showStatementManagerModal} onOpenChange={setShowStatementManagerModal} account={accountToManage} investments={investments} loans={loans} onStartConsolidatedReview={handleStartConsolidatedReview} onManageRules={handleManageRules} />}
      {accountForConsolidatedReview && <ConsolidatedReviewDialog open={showConsolidatedReview} onOpenChange={setShowConsolidatedReview} accountId={accountForConsolidatedReview} accounts={accounts} categories={categories} investments={investments} loans={loans} />}
      <StandardizationRuleManagerModal open={showRuleManagerModal} onOpenChange={setShowRuleManagerModal} rules={standardizationRules} onDeleteRule={deleteStandardizationRule} categories={categories} />
    </MainLayout>
  );
};

export default ReceitasDespesas;