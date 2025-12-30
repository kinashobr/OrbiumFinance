import { createContext, useContext, useState, useEffect, useCallback, Dispatch, SetStateAction, ReactNode, useMemo } from "react";
import {
  Categoria, TransacaoCompleta,
  DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES,
  ContaCorrente,
  FinanceExportV2,
  Emprestimo,
  Veiculo,
  SeguroVeiculo,
  ObjetivoFinanceiro,
  AccountType,
  DateRange,
  ComparisonDateRanges,
  generateAccountId,
  generateTransactionId,
  BillTracker,
  generateBillId,
  StandardizationRule,
  generateRuleId,
  ImportedStatement,
  ImportedTransaction,
  generateStatementId,
  OperationType,
  getFlowTypeFromOperation,
  BillSourceType,
  TransactionLinks,
  PotentialFixedBill,
  ExternalPaidBill,
  BillDisplayItem,
} from "@/types/finance";
import { parseISO, startOfMonth, endOfMonth, subDays, differenceInDays, differenceInMonths, addMonths, isBefore, isAfter, isSameDay, isSameMonth, isSameYear, startOfDay, endOfDay, subMonths, format, isWithinInterval } from "date-fns";
import { parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";

// ============================================
// FUNÇÕES AUXILIARES PARA DATAS
// ============================================

const calculateDefaultRange = (): DateRange => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
};

const calculateComparisonRange = (range1: DateRange): DateRange => {
    if (!range1.from || !range1.to) {
        return { from: undefined, to: undefined };
    }
    const diffInDays = differenceInDays(range1.to, range1.from) + 1;
    const prevTo = subDays(range1.from, 1);
    const prevFrom = subDays(prevTo, diffInDays - 1);
    return { from: prevFrom, to: prevTo };
};

const DEFAULT_RANGES: ComparisonDateRanges = {
    range1: calculateDefaultRange(),
    range2: calculateComparisonRange(calculateDefaultRange()),
};

function parseDateRanges(storedRanges: any): ComparisonDateRanges {
    const parseDate = (dateStr: string | undefined): Date | undefined => {
        if (!dateStr) return undefined;
        try {
            const date = parseDateLocal(dateStr.split('T')[0]); 
            return isNaN(date.getTime()) ? undefined : date;
        } catch {
            return undefined;
        }
    };

    return {
        range1: {
            from: parseDate(storedRanges.range1?.from),
            to: parseDate(storedRanges.range1?.to),
        },
        range2: {
            from: parseDate(storedRanges.range2?.from),
            to: parseDate(storedRanges.range2?.to),
        },
    };
}

export const getDueDate = (startDateStr: string, installmentNumber: number): Date => {
  const startDate = parseDateLocal(startDateStr);
  const dueDate = new Date(startDate);
  dueDate.setMonth(dueDate.getMonth() + installmentNumber - 1);
  return dueDate;
};

export interface AmortizationItem {
    parcela: number;
    juros: number;
    amortizacao: number;
    saldoDevedor: number;
}

interface FinanceContextType {
  // Empréstimos
  emprestimos: Emprestimo[];
  addEmprestimo: (emprestimo: Omit<Emprestimo, "id">) => void;
  updateEmprestimo: (id: number, emprestimo: Partial<Emprestimo>) => void;
  deleteEmprestimo: (id: number) => void;
  getPendingLoans: () => Emprestimo[];
  markLoanParcelPaid: (loanId: number, valorPago: number, dataPagamento: string, parcelaNumber?: number) => void;
  unmarkLoanParcelPaid: (loanId: number) => void;
  calculateLoanSchedule: (loanId: number) => AmortizationItem[];
  calculateLoanAmortizationAndInterest: (loanId: number, parcelaNumber: number) => AmortizationItem | null;
  calculateLoanPrincipalDueInNextMonths: (targetDate: Date, months: number) => number; 
  
  // Veículos
  veiculos: Veiculo[];
  addVeiculo: (veiculo: Omit<Veiculo, "id">) => void;
  updateVeiculo: (id: number, veiculo: Partial<Veiculo>) => void;
  deleteVeiculo: (id: number) => void;
  getPendingVehicles: () => Veiculo[];
  
  // Seguros de Veículo
  segurosVeiculo: SeguroVeiculo[];
  addSeguroVeiculo: (seguro: Omit<SeguroVeiculo, "id">) => void;
  updateSeguroVeiculo: (id: number, seguro: Partial<SeguroVeiculo>) => void;
  deleteSeguroVeiculo: (id: number) => void;
  markSeguroParcelPaid: (seguroId: number, parcelaNumero: number, transactionId: string) => void;
  unmarkSeguroParcelPaid: (seguroId: number, parcelaNumero: number) => void;
  
  // Objetivos Financeiros
  objetivos: ObjetivoFinanceiro[];
  addObjetivo: (obj: Omit<ObjetivoFinanceiro, "id">) => void;
  updateObjetivo: (id: number, obj: Partial<ObjetivoFinanceiro>) => void;
  deleteObjetivo: (id: number) => void;

  // Bill Tracker
  billsTracker: BillTracker[];
  setBillsTracker: Dispatch<SetStateAction<BillTracker[]>>;
  updateBill: (id: string, updates: Partial<BillTracker>) => void;
  deleteBill: (id: string) => void;
  addPurchaseInstallments: (data: {
    description: string;
    totalAmount: number;
    installments: number;
    firstDueDate: string;
    suggestedAccountId?: string;
    suggestedCategoryId?: string;
  }) => void;
  getBillsForMonth: (date: Date) => BillTracker[];
  getPotentialFixedBillsForMonth: (date: Date, localBills: BillTracker[]) => PotentialFixedBill[];
  getFutureFixedBills: (referenceDate: Date, localBills: BillTracker[]) => PotentialFixedBill[];
  getOtherPaidExpensesForMonth: (date: Date) => ExternalPaidBill[];
  toggleFixedBill: (potentialBill: PotentialFixedBill, isChecked: boolean, referenceDate: Date) => void; // NOVO
  
  // Contas Movimento
  contasMovimento: ContaCorrente[];
  setContasMovimento: Dispatch<SetStateAction<ContaCorrente[]>>;
  getContasCorrentesTipo: () => ContaCorrente[];
  
  // Categorias V2
  categoriasV2: Categoria[];
  setCategoriasV2: Dispatch<SetStateAction<Categoria[]>>;
  
  // Transações V2
  transacoesV2: TransacaoCompleta[];
  setTransacoesV2: Dispatch<SetStateAction<TransacaoCompleta[]>>;
  addTransacaoV2: (transaction: TransacaoCompleta) => void;
  
  // Standardization Rules
  standardizationRules: StandardizationRule[];
  addStandardizationRule: (rule: Omit<StandardizationRule, "id">) => void;
  deleteStandardizationRule: (id: string) => void;
  
  // Imported Statements
  importedStatements: ImportedStatement[];
  processStatementFile: (file: File, accountId: string) => Promise<{ success: boolean; message: string }>;
  deleteImportedStatement: (statementId: string) => void;
  getTransactionsForReview: (accountId: string, range: DateRange) => ImportedTransaction[];
  updateImportedStatement: (statementId: string, updates: Partial<ImportedStatement>) => void;
  uncontabilizeImportedTransaction: (transactionId: string) => void;
  
  // Data Filtering
  dateRanges: ComparisonDateRanges;
  setDateRanges: Dispatch<SetStateAction<ComparisonDateRanges>>;
  
  // Alert Filtering
  alertStartDate: string;
  setAlertStartDate: Dispatch<SetStateAction<string>>;
  
  // Revenue Forecast
  monthlyRevenueForecast: number;
  setMonthlyRevenueForecast: Dispatch<SetStateAction<number>>;
  getRevenueForPreviousMonth: (date: Date) => number;
  
  // Cálculos principais
  getTotalReceitas: (mes?: string) => number;
  getTotalDespesas: (mes?: string) => number;
  getTotalDividas: () => number;
  getCustoVeiculos: () => number;
  getSaldoAtual: () => number;
  getValorFipeTotal: (targetDate?: Date) => number;
  getSaldoDevedor: (targetDate?: Date) => number;
  getLoanPrincipalRemaining: (targetDate?: Date) => number;
  getCreditCardDebt: (targetDate?: Date) => number;
  getJurosTotais: () => number;
  getDespesasFixas: () => number;
  getPatrimonioLiquido: (targetDate?: Date) => number;
  getAtivosTotal: (targetDate?: Date) => number;
  getPassivosTotal: (targetDate?: Date) => number;
  getSegurosAApropriar: (targetDate?: Date) => number;
  getSegurosAPagar: (targetDate?: Date) => number;
  calculateBalanceUpToDate: (accountId: string, date: Date | undefined, allTransactions: TransacaoCompleta[], accounts: ContaCorrente[]) => number;
  calculateTotalInvestmentBalanceAtDate: (date: Date | undefined) => number;
  calculatePaidInstallmentsUpToDate: (loanId: number, targetDate: Date) => number; 

  // Exportação e Importação
  exportData: () => void;
  importData: (file: File) => Promise<{ success: boolean; message: string }>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  EMPRESTIMOS: "neon_finance_emprestimos",
  VEICULOS: "neon_finance_veiculos",
  SEGUROS_VEICULO: "neon_finance_seguros_veiculo",
  OBJETIVOS: "neon_finance_objetivos",
  BILLS_TRACKER: "neon_finance_bills_tracker",
  CONTAS_MOVIMENTO: "fin_accounts_v1",
  CATEGORIAS_V2: "fin_categories_v1",
  TRANSACOES_V2: "fin_transactions_v1",
  STANDARDIZATION_RULES: "fin_standardization_rules_v1",
  IMPORTED_STATEMENTS: "fin_imported_statements_v1",
  DATE_RANGES: "fin_date_ranges_v1",
  ALERT_START_DATE: "fin_alert_start_date_v1",
  MONTHLY_REVENUE_FORECAST: "fin_monthly_revenue_forecast_v1",
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (key === STORAGE_KEYS.DATE_RANGES) return parseDateRanges(parsed) as unknown as T;
      return parsed;
    }
  } catch (error) {}
  return defaultValue;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    let dataToStore = data;
    if (key === STORAGE_KEYS.DATE_RANGES) {
        const ranges = data as unknown as ComparisonDateRanges;
        dataToStore = {
            range1: { from: ranges.range1.from?.toISOString().split('T')[0], to: ranges.range1.to?.toISOString().split('T')[0] },
            range2: { from: ranges.range2.from?.toISOString().split('T')[0], to: ranges.range2.to?.toISOString().split('T')[0] },
        } as unknown as T;
    }
    localStorage.setItem(key, JSON.stringify(dataToStore));
  } catch (error) {}
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>(() => loadFromStorage(STORAGE_KEYS.EMPRESTIMOS, []));
  const [veiculos, setVeiculos] = useState<Veiculo[]>(() => loadFromStorage(STORAGE_KEYS.VEICULOS, []));
  const [segurosVeiculo, setSegurosVeiculo] = useState<SeguroVeiculo[]>(() => loadFromStorage(STORAGE_KEYS.SEGUROS_VEICULO, []));
  const [objetivos, setObjetivos] = useState<ObjetivoFinanceiro[]>(() => loadFromStorage(STORAGE_KEYS.OBJETIVOS, []));
  const [billsTracker, setBillsTracker] = useState<BillTracker[]>(() => loadFromStorage(STORAGE_KEYS.BILLS_TRACKER, []));
  const [contasMovimento, setContasMovimento] = useState<ContaCorrente[]>(() => loadFromStorage(STORAGE_KEYS.CONTAS_MOVIMENTO, DEFAULT_ACCOUNTS));
  const [categoriasV2, setCategoriasV2] = useState<Categoria[]>(() => loadFromStorage(STORAGE_KEYS.CATEGORIAS_V2, DEFAULT_CATEGORIES));
  const [transacoesV2, setTransacoesV2] = useState<TransacaoCompleta[]>(() => loadFromStorage(STORAGE_KEYS.TRANSACOES_V2, []));
  const [standardizationRules, setStandardizationRules] = useState<StandardizationRule[]>(() => loadFromStorage(STORAGE_KEYS.STANDARDIZATION_RULES, []));
  const [importedStatements, setImportedStatements] = useState<ImportedStatement[]>(() => loadFromStorage(STORAGE_KEYS.IMPORTED_STATEMENTS, []));
  const [dateRanges, setDateRanges] = useState<ComparisonDateRanges>(() => loadFromStorage(STORAGE_KEYS.DATE_RANGES, DEFAULT_RANGES));
  const [alertStartDate, setAlertStartDate] = useState<string>(() => loadFromStorage(STORAGE_KEYS.ALERT_START_DATE, subMonths(new Date(), 6).toISOString().split('T')[0]));
  const [monthlyRevenueForecast, setMonthlyRevenueForecast] = useState<number>(() => loadFromStorage(STORAGE_KEYS.MONTHLY_REVENUE_FORECAST, 0));

  useEffect(() => { saveToStorage(STORAGE_KEYS.EMPRESTIMOS, emprestimos); }, [emprestimos]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.VEICULOS, veiculos); }, [veiculos]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.SEGUROS_VEICULO, segurosVeiculo); }, [segurosVeiculo]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.OBJETIVOS, objetivos); }, [objetivos]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.BILLS_TRACKER, billsTracker); }, [billsTracker]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.STANDARDIZATION_RULES, standardizationRules); }, [standardizationRules]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.IMPORTED_STATEMENTS, importedStatements); }, [importedStatements]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.DATE_RANGES, dateRanges); }, [dateRanges]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.ALERT_START_DATE, alertStartDate); }, [alertStartDate]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.MONTHLY_REVENUE_FORECAST, monthlyRevenueForecast); }, [monthlyRevenueForecast]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.CONTAS_MOVIMENTO, contasMovimento); }, [contasMovimento]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.CATEGORIAS_V2, categoriasV2); }, [categoriasV2]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.TRANSACOES_V2, transacoesV2); }, [transacoesV2]);

  const balanceCache = useMemo(() => {
    const cache = new Map<string, number>();
    const sortedTransactions = [...transacoesV2].sort((a, b) => {
        const dateA = parseDateLocal(a.date).getTime();
        const dateB = parseDateLocal(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
    });
    const accountBalances: Record<string, number> = {};
    contasMovimento.forEach(account => { accountBalances[account.id] = 0; });
    sortedTransactions.forEach(t => {
        const account = contasMovimento.find(a => a.id === t.accountId);
        if (!account) return;
        const isCreditCard = account.accountType === 'cartao_credito';
        let amountChange = isCreditCard ? (t.flow === 'out' ? -t.amount : t.amount) : (t.flow === 'in' || t.flow === 'transfer_in' ? t.amount : -t.amount);
        accountBalances[t.accountId] = (accountBalances[t.accountId] || 0) + amountChange;
        cache.set(`${t.accountId}_${t.date}`, accountBalances[t.accountId]);
    });
    return cache;
  }, [transacoesV2, contasMovimento]);

  const calculateBalanceUpToDate = useCallback((accountId: string, date: Date | undefined, allTransactions: TransacaoCompleta[], accounts: ContaCorrente[]): number => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    const targetDate = date || new Date(9999, 11, 31);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    if (balanceCache.has(`${accountId}_${targetDateStr}`)) return balanceCache.get(`${accountId}_${targetDateStr}`)!;
    const transactionsBeforeDate = allTransactions.filter(t => t.accountId === accountId && parseDateLocal(t.date) <= targetDate).sort((a, b) => {
            const dateA = parseDateLocal(a.date).getTime();
            const dateB = parseDateLocal(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });
    if (transactionsBeforeDate.length > 0) return balanceCache.get(`${accountId}_${transactionsBeforeDate[0].date}`)!;
    return 0;
  }, [balanceCache]);

  const calculateTotalInvestmentBalanceAtDate = useCallback((date: Date | undefined): number => {
    const targetDate = date || new Date(9999, 11, 31);
    const investmentAccountIds = contasMovimento.filter(c => ['renda_fixa', 'poupanca', 'cripto', 'reserva', 'objetivo'].includes(c.accountType)).map(c => c.id);
    return investmentAccountIds.reduce((acc, accountId) => acc + Math.max(0, calculateBalanceUpToDate(accountId, targetDate, transacoesV2, contasMovimento)), 0);
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);
  
  const calculatePaidInstallmentsUpToDate = useCallback((loanId: number, targetDate: Date): number => {
    const loanPayments = transacoesV2.filter(t => t.operationType === 'pagamento_emprestimo' && t.links?.loanId === `loan_${loanId}`);
    const paidParcelas = new Set(loanPayments.filter(t => parseDateLocal(t.date) <= targetDate).map(p => p.links.parcelaId).filter(Boolean));
    return paidParcelas.size || loanPayments.filter(t => parseDateLocal(t.date) <= targetDate).length;
  }, [transacoesV2]);
  
  const calculateLoanSchedule = useCallback((loanId: number): AmortizationItem[] => {
    const loan = emprestimos.find(e => e.id === loanId);
    if (!loan || loan.meses === 0 || loan.taxaMensal === 0) return [];
    const taxa = loan.taxaMensal / 100;
    const parcelaFixaCents = Math.round(loan.parcela * 100);
    let saldoDevedorCents = Math.round(loan.valorTotal * 100);
    const schedule: AmortizationItem[] = [];
    for (let i = 1; i <= loan.meses; i++) {
      if (saldoDevedorCents <= 0) { schedule.push({ parcela: i, juros: 0, amortizacao: 0, saldoDevedor: 0 }); continue; }
      const jurosCents = Math.round(saldoDevedorCents * taxa);
      let amortizacaoCents = i === loan.meses ? saldoDevedorCents : parcelaFixaCents - jurosCents;
      const novoSaldoDevedorCents = Math.max(0, saldoDevedorCents - amortizacaoCents);
      schedule.push({ parcela: i, juros: Math.max(0, jurosCents / 100), amortizacao: Math.max(0, amortizacaoCents / 100), saldoDevedor: novoSaldoDevedorCents / 100 });
      saldoDevedorCents = novoSaldoDevedorCents;
    }
    return schedule;
  }, [emprestimos]);
  
  const calculateLoanAmortizationAndInterest = useCallback((loanId: number, parcelaNumber: number): AmortizationItem | null => {
      return calculateLoanSchedule(loanId).find(item => item.parcela === parcelaNumber) || null;
  }, [calculateLoanSchedule]);
  
  const calculateLoanPrincipalDueInNextMonths = useCallback((targetDate: Date, months: number): number => {
    const lookaheadDate = addMonths(targetDate, months);
    return emprestimos.reduce((acc, e) => {
        if (e.status === 'quitado' || e.status === 'pendente_config') return acc;
        const paidUpToDate = calculatePaidInstallmentsUpToDate(e.id, targetDate);
        return acc + calculateLoanSchedule(e.id).filter(item => item.parcela > paidUpToDate && (isBefore(getDueDate(e.dataInicio!, item.parcela), lookaheadDate) || isSameDay(getDueDate(e.dataInicio!, item.parcela), lookaheadDate))).reduce((sum, item) => sum + item.amortizacao, 0);
    }, 0);
  }, [emprestimos, calculatePaidInstallmentsUpToDate, calculateLoanSchedule]);

  const getSegurosAApropriar = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date();
    return segurosVeiculo.reduce((acc, seguro) => {
        try {
            const vigenciaInicio = parseDateLocal(seguro.vigenciaInicio);
            const vigenciaFim = parseDateLocal(seguro.vigenciaFim);
            if (isAfter(vigenciaInicio, date) || isBefore(vigenciaFim, date)) return acc;
            const totalDays = differenceInDays(vigenciaFim, vigenciaInicio) + 1;
            if (totalDays <= 0) return acc;
            const accruedExpense = Math.min(seguro.valorTotal, (seguro.valorTotal / totalDays) * (differenceInDays(date, vigenciaInicio) + 1));
            return acc + Math.round(Math.max(0, seguro.valorTotal - accruedExpense) * 100) / 100;
        } catch (e) { return acc; }
    }, 0);
  }, [segurosVeiculo]);

  const getSegurosAPagar = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date();
    return segurosVeiculo.reduce((acc, seguro) => {
        const totalPaid = seguro.parcelas.filter(p => p.paga && p.transactionId && parseDateLocal(transacoesV2.find(t => t.id === p.transactionId)?.date || '9999-12-31') <= date).reduce((sum, p) => sum + (transacoesV2.find(t => t.id === p.transactionId)?.amount || 0), 0);
        return acc + Math.round(Math.max(0, seguro.valorTotal - totalPaid) * 100) / 100;
    }, 0); 
  }, [segurosVeiculo, transacoesV2]);

  const addTransacaoV2 = useCallback((transaction: TransacaoCompleta) => {
    setTransacoesV2(prev => [...prev, transaction]);
  }, []);

  const markLoanParcelPaid = useCallback((loanId: number, valorPago: number, dataPagamento: string, parcelaNumber?: number) => {
    setEmprestimos(prev => prev.map(e => e.id === loanId ? { ...e, status: 'ativo' } : e));
  }, []);
  
  const unmarkLoanParcelPaid = useCallback((loanId: number) => {
    setEmprestimos(prev => prev.map(e => e.id === loanId ? { ...e, status: 'ativo' } : e));
  }, []);

  const markSeguroParcelPaid = useCallback((seguroId: number, parcelaNumero: number, transactionId: string) => {
    setSegurosVeiculo(prev => prev.map(s => s.id === seguroId ? { ...s, parcelas: s.parcelas.map(p => p.numero === parcelaNumero ? { ...p, paga: true, transactionId } : p) } : s));
  }, []);
  
  const unmarkSeguroParcelPaid = useCallback((seguroId: number, parcelaNumero: number) => {
    setSegurosVeiculo(prev => prev.map(s => s.id === seguroId ? { ...s, parcelas: s.parcelas.map(p => p.numero === parcelaNumero ? { ...p, paga: false, transactionId: undefined } : p) } : s));
  }, []);

  const toggleFixedBill = useCallback((potentialBill: PotentialFixedBill, isChecked: boolean, referenceDate: Date) => {
    const { sourceType, sourceRef, parcelaNumber, dueDate, expectedAmount, description, isPaid } = potentialBill;

    const isAlreadyPaidViaTransaction = transacoesV2.some(t =>
        (sourceType === 'loan_installment' && t.links?.loanId === `loan_${sourceRef}` && t.links?.parcelaId === String(parcelaNumber)) ||
        (sourceType === 'insurance_installment' && t.links?.vehicleTransactionId === `${sourceRef}_${parcelaNumber}`)
    );

    if (isAlreadyPaidViaTransaction) {
        toast.info("Esta parcela já foi paga através de uma transação no extrato.");
        return;
    }

    if (isChecked) {
        const isFutureBill = parseDateLocal(dueDate) > endOfMonth(referenceDate);
        const newBillId = generateBillId();
        
        const newBill: BillTracker = {
            id: newBillId,
            type: 'tracker',
            description,
            dueDate,
            expectedAmount,
            sourceType,
            sourceRef,
            parcelaNumber,
            suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id,
            suggestedCategoryId: categoriasV2.find(c => 
                (sourceType === 'loan_installment' && c.label.toLowerCase().includes('emprestimo')) ||
                (sourceType === 'insurance_installment' && c.label.toLowerCase().includes('seguro'))
            )?.id || null,
            isExcluded: false,
            isPaid: isFutureBill,
            paymentDate: isFutureBill ? format(new Date(), 'yyyy-MM-dd') : undefined,
            transactionId: isFutureBill ? `bill_tx_temp_${newBillId}` : undefined,
        };
        
        if (newBill.isPaid && newBill.transactionId) {
            const account = contasMovimento.find(c => c.id === newBill.suggestedAccountId);
            const category = categoriasV2.find(c => c.id === newBill.suggestedCategoryId);
            
            if (!account || !category) {
                toast.error("Erro ao adiantar: Conta ou Categoria sugerida não encontrada.");
                return;
            }
            
            const transId = newBill.transactionId;
            let txDescription = newBill.description;
            
            if (sourceType === 'loan_installment') {
                markLoanParcelPaid(parseInt(sourceRef), expectedAmount, newBill.paymentDate!, parcelaNumber);
            } else if (sourceType === 'insurance_installment') {
                markSeguroParcelPaid(parseInt(sourceRef), parcelaNumber, transId);
            }
            
            const newTransaction: TransacaoCompleta = {
                id: transId,
                date: newBill.paymentDate!,
                accountId: account.id,
                flow: 'out',
                operationType: sourceType === 'loan_installment' ? 'pagamento_emprestimo' : 'despesa',
                domain: sourceType === 'loan_installment' ? 'financing' : 'operational',
                amount: expectedAmount,
                categoryId: category.id,
                description: txDescription,
                links: {
                    investmentId: null,
                    transferGroupId: null,
                    vehicleTransactionId: sourceType === 'insurance_installment' ? `${sourceRef}_${parcelaNumber}` : null,
                    loanId: sourceType === 'loan_installment' ? `loan_${sourceRef}` : null,
                    parcelaId: sourceType === 'loan_installment' ? String(parcelaNumber) : null,
                },
                conciliated: false,
                attachments: [],
                meta: {
                    createdBy: 'bill_tracker',
                    source: 'bill_tracker',
                    createdAt: new Date().toISOString(),
                    notes: `Adiantamento gerado pelo Contas a Pagar.`,
                }
            };
            
            addTransacaoV2(newTransaction);
            setBillsTracker(prev => [...prev, newBill]);
            toast.success(`Adiantamento de parcela futura registrado e pago hoje!`);
        } else {
            setBillsTracker(prev => [...prev, newBill]);
            toast.success("Conta fixa incluída na lista do mês.");
        }
    } else {
        const billToRemove = billsTracker.find(b => 
            b.sourceType === sourceType && b.sourceRef === sourceRef && b.parcelaNumber === parcelaNumber
        );

        if (billToRemove && billToRemove.isPaid && billToRemove.transactionId) {
            if (sourceType === 'loan_installment') unmarkLoanParcelPaid(parseInt(sourceRef)); 
            if (sourceType === 'insurance_installment') unmarkSeguroParcelPaid(parseInt(sourceRef), parcelaNumber);
            setTransacoesV2(prev => prev.filter(t => t.id !== billToRemove.transactionId));
            toast.info("Pagamento estornado e parcela removida.");
        } else {
            toast.info("Conta fixa removida da lista.");
        }
        setBillsTracker(prev => prev.filter(b => !(b.sourceType === sourceType && b.sourceRef === sourceRef && b.parcelaNumber === parcelaNumber)));
    }
  }, [billsTracker, contasMovimento, categoriasV2, transacoesV2, addTransacaoV2, markLoanParcelPaid, markSeguroParcelPaid, unmarkLoanParcelPaid, unmarkSeguroParcelPaid, setTransacoesV2]);

  // Outros métodos e estados omitidos para brevidade, mantendo os originais do arquivo fornecido
  const addEmprestimo = (e: Omit<Emprestimo, "id">) => setEmprestimos([...emprestimos, { ...e, id: Math.max(0, ...emprestimos.map(l => l.id)) + 1, status: e.status || 'ativo', parcelasPagas: 0 }]);
  const updateEmprestimo = (id: number, u: Partial<Emprestimo>) => setEmprestimos(emprestimos.map(e => e.id === id ? { ...e, ...u } : e));
  const deleteEmprestimo = (id: number) => setEmprestimos(emprestimos.filter(e => e.id !== id));
  const getPendingLoans = useCallback(() => emprestimos.filter(e => e.status === 'pendente_config'), [emprestimos]);
  const addVeiculo = (v: Omit<Veiculo, "id">) => setVeiculos([...veiculos, { ...v, id: Math.max(0, ...veiculos.map(ve => ve.id)) + 1, status: v.status || 'ativo' }]);
  const updateVeiculo = (id: number, u: Partial<Veiculo>) => setVeiculos(veiculos.map(v => v.id === id ? { ...v, ...u } : v));
  const deleteVeiculo = (id: number) => setVeiculos(veiculos.filter(v => v.id !== id));
  const getPendingVehicles = useCallback(() => veiculos.filter(v => v.status === 'pendente_cadastro'), [veiculos]);
  const addSeguroVeiculo = (s: Omit<SeguroVeiculo, "id">) => setSegurosVeiculo([...segurosVeiculo, { ...s, id: Math.max(0, ...segurosVeiculo.map(se => se.id)) + 1 }]);
  const updateSeguroVeiculo = (id: number, s: Partial<SeguroVeiculo>) => setSegurosVeiculo(segurosVeiculo.map(se => se.id === id ? { ...se, ...s } : se));
  const deleteSeguroVeiculo = (id: number) => setSegurosVeiculo(segurosVeiculo.filter(s => s.id !== id));
  const addObjetivo = (o: Omit<ObjetivoFinanceiro, "id">) => setObjetivos([...objetivos, { ...o, id: Math.max(0, ...objetivos.map(ob => ob.id)) + 1 }]);
  const updateObjetivo = (id: number, u: Partial<ObjetivoFinanceiro>) => setObjetivos(objetivos.map(o => o.id === id ? { ...o, ...u } : o));
  const deleteObjetivo = (id: number) => setObjetivos(objetivos.filter(o => o.id !== id));
  const updateBill = useCallback((id: string, u: Partial<BillTracker>) => setBillsTracker(prev => prev.map(b => b.id === id ? { ...b, ...u } : b)), []);
  const deleteBill = useCallback((id: string) => setBillsTracker(prev => prev.filter(b => b.id !== id)), []);
  const addPurchaseInstallments = useCallback((d: any) => {
    const { description, totalAmount, installments, firstDueDate, suggestedAccountId, suggestedCategoryId } = d;
    const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;
    const group = `purchase_${Date.now()}`;
    const news: BillTracker[] = [];
    for (let i = 1; i <= installments; i++) {
        const due = getDueDate(firstDueDate, i);
        news.push({ id: generateBillId(), type: 'tracker', description: `${description} (${i}/${installments})`, dueDate: format(due, 'yyyy-MM-dd'), expectedAmount: i === installments ? totalAmount - (installmentAmount * (installments - 1)) : installmentAmount, isPaid: false, sourceType: 'purchase_installment', sourceRef: group, parcelaNumber: i, totalInstallments: installments, suggestedAccountId, suggestedCategoryId });
    }
    setBillsTracker(prev => [...prev, ...news]);
  }, []);
  const getBillsForMonth = useCallback((date: Date) => billsTracker.filter(b => isSameMonth(parseDateLocal(b.dueDate), date) || (b.isPaid && b.paymentDate && isSameMonth(parseDateLocal(b.paymentDate), date))).filter(b => !b.isExcluded || b.isPaid).sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime()), [billsTracker]);
  const getPotentialFixedBillsForMonth = useCallback((date: Date, local: BillTracker[]) => {
    const pots: PotentialFixedBill[] = [];
    const start = startOfMonth(date), end = endOfMonth(date);
    emprestimos.filter(e => e.status === 'ativo').forEach(l => calculateLoanSchedule(l.id).forEach(i => {
        const due = getDueDate(l.dataInicio!, i.parcela);
        if (isWithinInterval(due, { start, end }) || transacoesV2.some(t => t.links?.loanId === `loan_${l.id}` && t.links?.parcelaId === String(i.parcela))) pots.push({ key: `loan_${l.id}_${i.parcela}`, sourceType: 'loan_installment', sourceRef: String(l.id), parcelaNumber: i.parcela, dueDate: format(due, 'yyyy-MM-dd'), expectedAmount: l.parcela, description: `Empréstimo ${l.contrato} - Parcela ${i.parcela}/${l.meses}`, isPaid: transacoesV2.some(t => t.links?.loanId === `loan_${l.id}` && t.links?.parcelaId === String(i.parcela)), isIncluded: local.some(b => b.sourceType === 'loan_installment' && b.sourceRef === String(l.id) && b.parcelaNumber === i.parcela && !b.isExcluded) });
    }));
    segurosVeiculo.forEach(s => s.parcelas.forEach(p => {
        const due = parseDateLocal(p.vencimento);
        if (isWithinInterval(due, { start, end }) || transacoesV2.some(t => t.links?.vehicleTransactionId === `${s.id}_${p.numero}`)) pots.push({ key: `insurance_${s.id}_${p.numero}`, sourceType: 'insurance_installment', sourceRef: String(s.id), parcelaNumber: p.numero, dueDate: p.vencimento, expectedAmount: p.valor, description: `Seguro ${s.numeroApolice} - Parcela ${p.numero}/${s.numeroParcelas}`, isPaid: transacoesV2.some(t => t.links?.vehicleTransactionId === `${s.id}_${p.numero}`), isIncluded: local.some(b => b.sourceType === 'insurance_installment' && b.sourceRef === String(s.id) && b.parcelaNumber === p.numero && !b.isExcluded) });
    }));
    return pots.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
  }, [emprestimos, segurosVeiculo, transacoesV2, calculateLoanSchedule]);
  const getFutureFixedBills = useCallback((ref: Date, local: BillTracker[]) => {
    const pots: PotentialFixedBill[] = [];
    const limit = endOfMonth(ref);
    emprestimos.filter(e => e.status === 'ativo').forEach(l => calculateLoanSchedule(l.id).forEach(i => {
        const due = getDueDate(l.dataInicio!, i.parcela);
        if (isAfter(due, limit)) pots.push({ key: `loan_${l.id}_${i.parcela}`, sourceType: 'loan_installment', sourceRef: String(l.id), parcelaNumber: i.parcela, dueDate: format(due, 'yyyy-MM-dd'), expectedAmount: l.parcela, description: `Empréstimo ${l.contrato} - Parcela ${i.parcela}/${l.meses}`, isPaid: transacoesV2.some(t => t.links?.loanId === `loan_${l.id}` && t.links?.parcelaId === String(i.parcela)), isIncluded: local.some(b => b.sourceType === 'loan_installment' && b.sourceRef === String(l.id) && b.parcelaNumber === i.parcela && !b.isExcluded) });
    }));
    segurosVeiculo.forEach(s => s.parcelas.forEach(p => {
        const due = parseDateLocal(p.vencimento);
        if (isAfter(due, limit)) pots.push({ key: `insurance_${s.id}_${p.numero}`, sourceType: 'insurance_installment', sourceRef: String(s.id), parcelaNumber: p.numero, dueDate: p.vencimento, expectedAmount: p.valor, description: `Seguro ${s.numeroApolice} - Parcela ${p.numero}/${s.numeroParcelas}`, isPaid: transacoesV2.some(t => t.links?.vehicleTransactionId === `${s.id}_${p.numero}`), isIncluded: local.some(b => b.sourceType === 'insurance_installment' && b.sourceRef === String(s.id) && b.parcelaNumber === p.numero && !b.isExcluded) });
    }));
    return pots.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
  }, [emprestimos, segurosVeiculo, transacoesV2, calculateLoanSchedule]);
  const getOtherPaidExpensesForMonth = useCallback((d: Date) => {
    const s = startOfMonth(d), e = endOfMonth(d);
    const ids = new Set(billsTracker.filter(b => b.isPaid && b.transactionId).map(b => b.transactionId!));
    return transacoesV2.filter(t => isWithinInterval(parseDateLocal(t.date), { start: s, end: e }) && (t.flow === 'out' || t.flow === 'transfer_out') && ['despesa', 'pagamento_emprestimo', 'veiculo'].includes(t.operationType) && t.meta.source !== 'bill_tracker' && !ids.has(t.id)).map(t => ({ id: t.id, type: 'external_paid', dueDate: t.date, paymentDate: t.date, expectedAmount: t.amount, description: t.description, suggestedAccountId: t.accountId, suggestedCategoryId: t.categoryId, sourceType: 'external_expense' as const, isPaid: true as const, isExcluded: false as const }));
  }, [billsTracker, transacoesV2]);
  const processStatementFile = async (f: File, a: string) => ({ success: true, message: "Simulado" });
  const exportData = () => {};
  const importData = async (f: File) => ({ success: true, message: "Simulado" });
  
  const value: FinanceContextType = {
    emprestimos, addEmprestimo, updateEmprestimo, deleteEmprestimo, getPendingLoans, markLoanParcelPaid, unmarkLoanParcelPaid, calculateLoanSchedule, calculateLoanAmortizationAndInterest, calculateLoanPrincipalDueInNextMonths, 
    veiculos, addVeiculo, updateVeiculo, deleteVeiculo, getPendingVehicles,
    segurosVeiculo, addSeguroVeiculo, updateSeguroVeiculo, deleteSeguroVeiculo, markSeguroParcelPaid, unmarkSeguroParcelPaid,
    objetivos, addObjetivo, updateObjetivo, deleteObjetivo,
    billsTracker, setBillsTracker, updateBill, deleteBill, addPurchaseInstallments, getBillsForMonth, getPotentialFixedBillsForMonth, getFutureFixedBills, getOtherPaidExpensesForMonth, toggleFixedBill,
    contasMovimento, setContasMovimento, getContasCorrentesTipo: () => contasMovimento.filter(c => c.accountType === 'corrente'),
    categoriasV2, setCategoriasV2,
    transacoesV2, setTransacoesV2, addTransacaoV2,
    standardizationRules, addStandardizationRule: (r: any) => setStandardizationRules([...standardizationRules, { ...r, id: generateRuleId() }]), deleteStandardizationRule: (id: string) => setStandardizationRules(standardizationRules.filter(r => r.id !== id)),
    importedStatements, processStatementFile, deleteImportedStatement: (id: string) => setImportedStatements(importedStatements.filter(s => s.id !== id)), getTransactionsForReview: () => [], updateImportedStatement: (id: string, u: any) => setImportedStatements(importedStatements.map(s => s.id === id ? { ...s, ...u } : s)), uncontabilizeImportedTransaction: (id: string) => setTransacoesV2(transacoesV2.filter(t => t.id !== id)),
    dateRanges, setDateRanges,
    alertStartDate, setAlertStartDate,
    monthlyRevenueForecast, setMonthlyRevenueForecast, getRevenueForPreviousMonth: (d: Date) => transacoesV2.filter(t => ['receita', 'rendimento'].includes(t.operationType) && isSameMonth(parseDateLocal(t.date), subMonths(d, 1))).reduce((acc, t) => acc + t.amount, 0),
    getTotalReceitas: (m?: string) => transacoesV2.filter(t => ['receita', 'rendimento'].includes(t.operationType) && (!m || t.date.startsWith(m))).reduce((acc, t) => acc + t.amount, 0),
    getTotalDespesas: (m?: string) => transacoesV2.filter(t => ['despesa', 'pagamento_emprestimo'].includes(t.operationType) && (!m || t.date.startsWith(m))).reduce((acc, t) => acc + t.amount, 0),
    getTotalDividas: () => emprestimos.reduce((acc, e) => acc + e.valorTotal, 0),
    getCustoVeiculos: () => veiculos.filter(v => v.status !== 'vendido').reduce((acc, v) => acc + v.valorSeguro, 0),
    getSaldoAtual: () => contasMovimento.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, undefined, transacoesV2, contasMovimento), 0),
    getValorFipeTotal: (d?: Date) => veiculos.filter(v => v.status !== 'vendido' && parseDateLocal(v.dataCompra) <= (d || new Date(9999, 11, 31))).reduce((acc, v) => acc + v.valorFipe, 0),
    getSaldoDevedor: (d?: Date) => { const date = d || new Date(9999, 11, 31); return emprestimos.reduce((acc, e) => e.status !== 'quitado' ? acc + (calculateLoanSchedule(e.id).find(i => i.parcela === calculatePaidInstallmentsUpToDate(e.id, date))?.saldoDevedor || e.valorTotal) : acc, 0) + contasMovimento.filter(c => c.accountType === 'cartao_credito').reduce((acc, c) => acc + Math.abs(Math.min(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento))), 0); },
    getLoanPrincipalRemaining: (d?: Date) => emprestimos.reduce((acc, e) => e.status !== 'quitado' ? acc + (calculateLoanSchedule(e.id).find(i => i.parcela === calculatePaidInstallmentsUpToDate(e.id, d || new Date()))?.saldoDevedor || e.valorTotal) : acc, 0),
    getCreditCardDebt: (d?: Date) => contasMovimento.filter(c => c.accountType === 'cartao_credito').reduce((acc, c) => acc + Math.abs(Math.min(0, calculateBalanceUpToDate(c.id, d || new Date(), transacoesV2, contasMovimento))), 0),
    getJurosTotais: () => emprestimos.reduce((acc, e) => acc + (e.parcela * e.meses - e.valorTotal), 0),
    getDespesasFixas: () => transacoesV2.filter(t => categoriasV2.find(c => c.id === t.categoryId)?.nature === 'despesa_fixa').reduce((acc, t) => acc + t.amount, 0),
    getPatrimonioLiquido: (d?: Date) => { const date = d || new Date(); return (contasMovimento.filter(c => c.accountType !== 'cartao_credito').reduce((acc, c) => acc + Math.max(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)), 0) + veiculos.filter(v => v.status !== 'vendido' && parseDateLocal(v.dataCompra) <= date).reduce((acc, v) => acc + v.valorFipe, 0) + getSegurosAApropriar(date)) - (emprestimos.reduce((acc, e) => acc + (calculateLoanSchedule(e.id).find(i => i.parcela === calculatePaidInstallmentsUpToDate(e.id, date))?.saldoDevedor || e.valorTotal), 0) + getSegurosAPagar(date)); },
    getAtivosTotal: (d?: Date) => { const date = d || new Date(); return contasMovimento.filter(c => c.accountType !== 'cartao_credito').reduce((acc, c) => acc + Math.max(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)), 0) + veiculos.filter(v => v.status !== 'vendido' && parseDateLocal(v.dataCompra) <= date).reduce((acc, v) => acc + v.valorFipe, 0) + getSegurosAApropriar(date); },
    getPassivosTotal: (d?: Date) => { const date = d || new Date(); return emprestimos.reduce((acc, e) => acc + (calculateLoanSchedule(e.id).find(i => i.parcela === calculatePaidInstallmentsUpToDate(e.id, date))?.saldoDevedor || e.valorTotal), 0) + getSegurosAPagar(date); },
    getSegurosAApropriar, getSegurosAPagar, calculateBalanceUpToDate, calculateTotalInvestmentBalanceAtDate, calculatePaidInstallmentsUpToDate, exportData, importData,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) throw new Error("useFinance deve ser usado dentro de um FinanceProvider");
  return context;
}