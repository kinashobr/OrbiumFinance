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
} from "@/types/finance";
import { parseISO, startOfMonth, endOfMonth, subDays, differenceInDays, differenceInMonths, addMonths, isBefore, isAfter, isSameDay, isSameMonth, isSameYear, startOfDay, endOfDay, subMonths, format, isWithinInterval } from "date-fns";
import { parseDateLocal } from "@/lib/utils";

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

const normalizeAmount = (amountStr: string): number => {
    let cleaned = amountStr.trim();
    const isNegative = cleaned.startsWith('-');
    
    if (isNegative) {
        cleaned = cleaned.substring(1);
    }
    
    cleaned = cleaned.replace(/[^\d.,]/g, '');

    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.')) {
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            const lastPart = parts.pop();
            cleaned = parts.join('') + '.' + lastPart;
        }
    }
    
    const parsed = parseFloat(cleaned);
    
    return isNegative ? -parsed : parsed;
};

const normalizeOfxDate = (dateStr: string): string => {
    if (dateStr.length >= 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
};

const parseCSV = (content: string, accountId: string): ImportedTransaction[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const separator = lines[0].includes('\t') ? '\t' : ',';
    
    const header = lines[0].toLowerCase();
    const cols = header.split(separator);
    
    const normalizeHeader = (h: string) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, '').trim();
    
    const dataIndex = cols.findIndex(h => normalizeHeader(h).includes('data'));
    const valorIndex = cols.findIndex(h => normalizeHeader(h).includes('valor'));
    const descIndex = cols.findIndex(h => normalizeHeader(h).includes('descri'));

    if (dataIndex === -1 || valorIndex === -1 || descIndex === -1) {
        throw new Error(`CSV inválido. Colunas 'Data', 'Valor' e 'Descrição' são obrigatógrias. Separador detectado: '${separator}'`);
    }

    const transactions: ImportedTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
        const lineCols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        
        if (lineCols.length > Math.max(dataIndex, valorIndex, descIndex)) {
            const dateStr = lineCols[dataIndex];
            const amountStr = lineCols[valorIndex];
            const originalDescription = lineCols[descIndex];
            
            if (!dateStr || !amountStr || !originalDescription) continue;

            const amount = normalizeAmount(amountStr);
            
            let normalizedDate = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
            } else {
                normalizedDate = normalizeOfxDate(dateStr);
            }
            
            if (normalizedDate.length < 10 || isNaN(parseDateLocal(normalizedDate).getTime())) {
                continue;
            }

            transactions.push({
                id: generateTransactionId(),
                date: normalizedDate,
                amount: Math.abs(amount),
                originalDescription,
                accountId,
                categoryId: null,
                operationType: amount < 0 ? 'despesa' : 'receita',
                description: originalDescription,
                isTransfer: false,
                destinationAccountId: null,
                tempInvestmentId: null,
                tempLoanId: null,
                tempParcelaId: null,
                tempVehicleOperation: null,
                sourceType: 'csv',
                isContabilized: false,
                contabilizedTransactionId: undefined,
                isPotentialDuplicate: false,
                duplicateOfTxId: undefined,
            });
        }
    }
    return transactions;
};

const parseOFX = (content: string, accountId: string): ImportedTransaction[] => {
    const transactions: ImportedTransaction[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
        const stmtTrnBlock = match[1];
        
        const dtPostedMatch = stmtTrnBlock.match(/<DTPOSTED>(\d+)/);
        const trnAmtMatch = stmtTrnBlock.match(/<TRNAMT>([\d.-]+)/);
        const memoMatch = stmtTrnBlock.match(/<MEMO>([\s\S]*?)</);

        if (dtPostedMatch && trnAmtMatch && memoMatch) {
            const dateStr = dtPostedMatch[1];
            const amount = parseFloat(trnAmtMatch[1]);
            const originalDescription = memoMatch[1].trim();
            
            if (isNaN(amount)) continue;

            const normalizedDate = normalizeOfxDate(dateStr);
            
            const operationType: OperationType = amount < 0 ? 'despesa' : 'receita';

            transactions.push({
                id: generateTransactionId(),
                date: normalizedDate,
                amount: Math.abs(amount),
                originalDescription,
                accountId,
                categoryId: null,
                operationType,
                description: originalDescription,
                isTransfer: false,
                destinationAccountId: null,
                tempInvestmentId: null,
                tempLoanId: null,
                tempParcelaId: null,
                tempVehicleOperation: null,
                sourceType: 'ofx',
                isContabilized: false,
                contabilizedTransactionId: undefined,
                isPotentialDuplicate: false,
                duplicateOfTxId: undefined,
            });
        }
    }
    return transactions;
};

export interface AmortizationItem {
    parcela: number;
    juros: number;
    amortizacao: number;
    saldoDevedor: number;
}

interface FinanceContextType {
  emprestimos: Emprestimo[];
  addEmprestimo: (emprestimo: Omit<Emprestimo, "id">) => void;
  updateEmprestimo: (id: number, emprestimo: Partial<Emprestimo>) => void;
  deleteEmprestimo: (id: number) => void;
  getPendingLoans: () => Emprestimo[];
  markLoanParcelPaid: (loanId: number, valorPago: number, dataPagamento: string, parcelaNumero?: number) => void;
  unmarkLoanParcelPaid: (loanId: number) => void;
  calculateLoanSchedule: (loanId: number) => AmortizationItem[];
  calculateLoanAmortizationAndInterest: (loanId: number, parcelaNumber: number) => AmortizationItem | null;
  calculateLoanPrincipalDueInNextMonths: (targetDate: Date, months: number) => number; 
  
  veiculos: Veiculo[];
  addVeiculo: (veiculo: Omit<Veiculo, "id">) => void;
  updateVeiculo: (id: number, veiculo: Partial<Veiculo>) => void;
  deleteVeiculo: (id: number) => void;
  getPendingVehicles: () => Veiculo[];
  
  segurosVeiculo: SeguroVeiculo[];
  addSeguroVeiculo: (seguro: Omit<SeguroVeiculo, "id">) => void;
  updateSeguroVeiculo: (id: number, seguro: Partial<SeguroVeiculo>) => void;
  deleteSeguroVeiculo: (id: number) => void;
  markSeguroParcelPaid: (seguroId: number, parcelaNumero: number, transactionId: string) => void;
  unmarkSeguroParcelPaid: (seguroId: number, parcelaNumero: number) => void;
  
  objetivos: ObjetivoFinanceiro[];
  addObjetivo: (obj: Omit<ObjetivoFinanceiro, "id">) => void;
  updateObjetivo: (id: number, obj: Partial<ObjetivoFinanceiro>) => void;
  deleteObjetivo: (id: number) => void;

  billsTracker: BillTracker[];
  setBillsTracker: Dispatch<SetStateAction<BillTracker[]>>;
  updateBill: (id: string, updates: Partial<BillTracker>) => void;
  deleteBill: (id: string) => void;
  getBillsForMonth: (date: Date) => BillTracker[];
  getPotentialFixedBillsForMonth: (date: Date, localBills: BillTracker[]) => PotentialFixedBill[];
  getFutureFixedBills: (referenceDate: Date, localBills: BillTracker[]) => PotentialFixedBill[];
  
  contasMovimento: ContaCorrente[];
  setContasMovimento: Dispatch<SetStateAction<ContaCorrente[]>>;
  getContasCorrentesTipo: () => ContaCorrente[];
  
  categoriasV2: Categoria[];
  setCategoriasV2: Dispatch<SetStateAction<Categoria[]>>;
  
  transacoesV2: TransacaoCompleta[];
  setTransacoesV2: Dispatch<SetStateAction<TransacaoCompleta[]>>;
  addTransacaoV2: (transaction: TransacaoCompleta) => void;
  
  standardizationRules: StandardizationRule[];
  addStandardizationRule: (rule: Omit<StandardizationRule, "id">) => void;
  deleteStandardizationRule: (id: string) => void;
  
  importedStatements: ImportedStatement[];
  processStatementFile: (file: File, accountId: string) => Promise<{ success: boolean; message: string }>;
  deleteImportedStatement: (statementId: string) => void;
  getTransactionsForReview: (accountId: string, range: DateRange) => ImportedTransaction[];
  updateImportedStatement: (statementId: string, updates: Partial<ImportedStatement>) => void;
  uncontabilizeImportedTransaction: (transactionId: string) => void;
  
  dateRanges: ComparisonDateRanges;
  setDateRanges: Dispatch<SetStateAction<ComparisonDateRanges>>;
  
  alertStartDate: string;
  setAlertStartDate: Dispatch<SetStateAction<string>>;
  
  monthlyRevenueForecast: number;
  setMonthlyRevenueForecast: Dispatch<SetStateAction<number>>;
  getRevenueForPreviousMonth: (date: Date) => number;
  
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
  
  getTransactionsForMonth: (date: Date) => TransacaoCompleta[]; // NOVO
  
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

const initialEmprestimos: Emprestimo[] = [];
const initialVeiculos: Veiculo[] = [];
const initialSegurosVeiculo: SeguroVeiculo[] = [];
const initialObjetivos: ObjetivoFinanceiro[] = [];
const initialBillsTracker: BillTracker[] = [];
const initialStandardizationRules: StandardizationRule[] = [];
const initialImportedStatements: ImportedStatement[] = [];

const defaultAlertStartDate = subMonths(new Date(), 6).toISOString().split('T')[0];

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      if (key === STORAGE_KEYS.DATE_RANGES) {
          return parseDateRanges(parsed) as unknown as T;
      }
      
      return parsed;
    }
  } catch (error) {
    console.error(`Erro ao carregar ${key} do localStorage:`, error);
  }
  
  return defaultValue;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    let dataToStore = data;
    if (key === STORAGE_KEYS.DATE_RANGES) {
        const ranges = data as unknown as ComparisonDateRanges;
        dataToStore = {
            range1: {
                from: ranges.range1.from?.toISOString().split('T')[0],
                to: ranges.range1.to?.toISOString().split('T')[0],
            },
            range2: {
                from: ranges.range2.from?.toISOString().split('T')[0],
                to: ranges.range2.to?.toISOString().split('T')[0],
            },
        } as unknown as T;
    }
    
    localStorage.setItem(key, JSON.stringify(dataToStore));
  } catch (error) {
    console.error(`Erro ao salvar ${key} no localStorage:`, error);
  }
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>(() => 
    loadFromStorage(STORAGE_KEYS.EMPRESTIMOS, initialEmprestimos)
  );
  const [veiculos, setVeiculos] = useState<Veiculo[]>(() => 
    loadFromStorage(STORAGE_KEYS.VEICULOS, initialVeiculos)
  );
  const [segurosVeiculo, setSegurosVeiculo] = useState<SeguroVeiculo[]>(() => 
    loadFromStorage(STORAGE_KEYS.SEGUROS_VEICULO, initialSegurosVeiculo)
  );
  const [objetivos, setObjetivos] = useState<ObjetivoFinanceiro[]>(() => 
    loadFromStorage(STORAGE_KEYS.OBJETIVOS, initialObjetivos)
  );
  
  const [billsTracker, setBillsTracker] = useState<BillTracker[]>(() => 
    loadFromStorage(STORAGE_KEYS.BILLS_TRACKER, initialBillsTracker)
  );
  
  const [contasMovimento, setContasMovimento] = useState<ContaCorrente[]>(() => 
    loadFromStorage(STORAGE_KEYS.CONTAS_MOVIMENTO, DEFAULT_ACCOUNTS)
  );
  const [categoriasV2, setCategoriasV2] = useState<Categoria[]>(() => 
    loadFromStorage(STORAGE_KEYS.CATEGORIAS_V2, DEFAULT_CATEGORIES)
  );
  const [transacoesV2, setTransacoesV2] = useState<TransacaoCompleta[]>(() => 
    loadFromStorage(STORAGE_KEYS.TRANSACOES_V2, [])
  );
  
  const [standardizationRules, setStandardizationRules] = useState<StandardizationRule[]>(() => 
    loadFromStorage(STORAGE_KEYS.STANDARDIZATION_RULES, initialStandardizationRules)
  );
  
  const [importedStatements, setImportedStatements] = useState<ImportedStatement[]>(() => 
    loadFromStorage(STORAGE_KEYS.IMPORTED_STATEMENTS, initialImportedStatements)
  );
  
  const [dateRanges, setDateRanges] = useState<ComparisonDateRanges>(() => 
    loadFromStorage(STORAGE_KEYS.DATE_RANGES, DEFAULT_RANGES)
  );
  
  const [alertStartDate, setAlertStartDate] = useState<string>(() => 
    loadFromStorage(STORAGE_KEYS.ALERT_START_DATE, defaultAlertStartDate)
  );
  
  const [monthlyRevenueForecast, setMonthlyRevenueForecast] = useState<number>(() => 
    loadFromStorage(STORAGE_KEYS.MONTHLY_REVENUE_FORECAST, 0)
  );

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
    
    contasMovimento.forEach(account => {
        accountBalances[account.id] = 0;
    });
    
    sortedTransactions.forEach(t => {
        const account = contasMovimento.find(a => a.id === t.accountId);
        if (!account) return;
        
        const dateKey = t.date;
        
        const isCreditCard = account.accountType === 'cartao_credito';
        
        let amountChange = 0;
        if (isCreditCard) {
            if (t.flow === 'out') {
                amountChange = -t.amount;
            } else if (t.flow === 'in') {
                amountChange = t.amount;
            }
        } else {
            if (t.flow === 'in' || t.flow === 'transfer_in') {
                amountChange = t.amount;
            } else {
                amountChange = -t.amount;
            }
        }
        
        accountBalances[t.accountId] = (accountBalances[t.accountId] || 0) + amountChange;
        
        cache.set(`${t.accountId}_${dateKey}`, accountBalances[t.accountId]);
    });
    
    return cache;
  }, [transacoesV2, contasMovimento]);


  const calculateBalanceUpToDate = useCallback((accountId: string, date: Date | undefined, allTransactions: TransacaoCompleta[], accounts: ContaCorrente[]): number => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;

    const targetDate = date || new Date(9999, 11, 31);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    
    if (balanceCache.has(`${accountId}_${targetDateStr}`)) {
        return balanceCache.get(`${accountId}_${targetDateStr}`)!;
    }
    
    const transactionsBeforeDate = allTransactions
        .filter(t => t.accountId === accountId && parseDateLocal(t.date) <= targetDate)
        .sort((a, b) => {
            const dateA = parseDateLocal(a.date).getTime();
            const dateB = parseDateLocal(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });
        
    if (transactionsBeforeDate.length > 0) {
        const latestTx = transactionsBeforeDate[0];
        const latestDateStr = latestTx.date;
        
        if (latestDateStr === targetDateStr) {
            return balanceCache.get(`${accountId}_${latestDateStr}`)!;
        }
        
        if (parseDateLocal(latestDateStr) < targetDate) {
            return balanceCache.get(`${accountId}_${latestDateStr}`)!;
        }
    }

    return 0;
  }, [balanceCache]);

  const calculateTotalInvestmentBalanceAtDate = useCallback((date: Date | undefined): number => {
    const targetDate = date || new Date(9999, 11, 31);
    
    const investmentAccountIds = contasMovimento
      .filter(c => 
        c.accountType === 'renda_fixa' || 
        c.accountType === 'poupanca' ||
        c.accountType === 'cripto' ||
        c.accountType === 'reserva' ||
        c.accountType === 'objetivo'
      )
      .map(c => c.id);

    return investmentAccountIds.reduce((acc, accountId) => {
        const balance = calculateBalanceUpToDate(accountId, targetDate, transacoesV2, contasMovimento);
        return acc + Math.max(0, balance);
    }, 0);
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);
  
  const calculatePaidInstallmentsUpToDate = useCallback((loanId: number, targetDate: Date): number => {
    const loan = emprestimos.find(e => e.id === loanId);
    if (!loan || !loan.dataInicio) return 0;

    const loanPayments = transacoesV2.filter(t => 
      t.operationType === 'pagamento_emprestimo' && 
      t.links?.loanId === `loan_${loanId}`
    );

    const paymentsUpToDate = loanPayments.filter(t => 
      parseDateLocal(t.date) <= targetDate
    );
    
    const paidParcelas = new Set<string>();
    paymentsUpToDate.forEach(p => {
        if (p.links?.parcelaId) {
            paidParcelas.add(p.links.parcelaId);
        }
    });
    
    if (paidParcelas.size > 0) {
        return paidParcelas.size;
    }

    return paymentsUpToDate.length;

  }, [emprestimos, transacoesV2]);
  
  const calculateLoanSchedule = useCallback((loanId: number): AmortizationItem[] => {
    const loan = emprestimos.find(e => e.id === loanId);
    if (!loan || loan.meses === 0 || loan.taxaMensal === 0) return [];

    const taxa = loan.taxaMensal / 100;
    const parcelaFixaCents = Math.round(loan.parcela * 100);
    let saldoDevedorCents = Math.round(loan.valorTotal * 100);
    
    const schedule: AmortizationItem[] = [];

    for (let i = 1; i <= loan.meses; i++) {
      if (saldoDevedorCents <= 0) {
        schedule.push({
          parcela: i,
          juros: 0,
          amortizacao: 0,
          saldoDevedor: 0,
        });
        continue;
      }
      
      const jurosCents = Math.round(saldoDevedorCents * taxa);
      let amortizacaoCents = parcelaFixaCents - jurosCents;
      
      if (i === loan.meses) {
          amortizacaoCents = saldoDevedorCents;
      }
      
      const novoSaldoDevedorCents = Math.max(0, saldoDevedorCents - amortizacaoCents);
      
      const juros = jurosCents / 100;
      const amortizacao = amortizacaoCents / 100;
      const novoSaldoDevedor = novoSaldoDevedorCents / 100;
      
      schedule.push({
        parcela: i,
        juros: Math.max(0, juros),
        amortizacao: Math.max(0, amortizacao),
        saldoDevedor: novoSaldoDevedor,
      });
      
      saldoDevedorCents = novoSaldoDevedorCents;
    }
    
    return schedule;
  }, [emprestimos]);
  
  const calculateLoanAmortizationAndInterest = useCallback((loanId: number, parcelaNumber: number): AmortizationItem | null => {
      const schedule = calculateLoanSchedule(loanId);
      return schedule.find(item => item.parcela === parcelaNumber) || null;
  }, [calculateLoanSchedule]);
  
  const calculateLoanPrincipalDueInNextMonths = useCallback((targetDate: Date, months: number): number => {
    const lookaheadDate = addMonths(targetDate, months);
    
    return emprestimos.reduce((acc, e) => {
        if (e.status === 'quitado' || e.status === 'pendente_config') return acc;

        let principalDue = 0;
        
        const paidUpToDate = calculatePaidInstallmentsUpToDate(e.id, targetDate);
        const schedule = calculateLoanSchedule(e.id);
        
        schedule.forEach(item => {
            const dueDate = getDueDate(e.dataInicio!, item.parcela);
            
            if (item.parcela <= paidUpToDate) {
                return;
            }
            
            if (isBefore(dueDate, lookaheadDate) || isSameDay(dueDate, lookaheadDate)) {
                principalDue += item.amortizacao;
            }
        });
        
        return acc + principalDue;
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
            
            const dailyAccrual = seguro.valorTotal / totalDays;
            
            const daysConsumed = differenceInDays(date, vigenciaInicio) + 1;
            
            const accruedExpense = Math.min(seguro.valorTotal, dailyAccrual * daysConsumed);
            
            const segurosAApropriar = Math.max(0, seguro.valorTotal - accruedExpense);
            
            return acc + Math.round(segurosAApropriar * 100) / 100;
        } catch (e) {
            return acc;
        }
    }, 0);
  }, [segurosVeiculo]);

  const getSegurosAPagar = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date();
    
    return segurosVeiculo.reduce((acc, seguro) => {
        let totalPaid = 0;
        
        seguro.parcelas.forEach(parcela => {
            if (parcela.paga && parcela.transactionId) {
                const paymentTx = transacoesV2.find(t => t.id === parcela.transactionId);
                
                if (paymentTx && parseDateLocal(paymentTx.date) <= date) {
                    totalPaid += paymentTx.amount; 
                }
            }
        });
        
        const segurosAPagar = Math.max(0, seguro.valorTotal - totalPaid);
        
        return acc + Math.round(segurosAPagar * 100) / 100;
    }, 0); 
  }, [segurosVeiculo, transacoesV2]);

  const applyRules = useCallback((transactions: ImportedTransaction[], rules: StandardizationRule[]): ImportedTransaction[] => {
    return transactions.map(tx => {
      let updatedTx = { ...tx };
      const originalDesc = tx.originalDescription.toLowerCase();
      
      for (const rule of rules) {
        if (originalDesc.includes(rule.pattern.toLowerCase())) {
          updatedTx.categoryId = rule.categoryId;
          updatedTx.operationType = rule.operationType;
          updatedTx.description = rule.descriptionTemplate;
          
          if (rule.operationType === 'transferencia') {
              updatedTx.isTransfer = true;
              updatedTx.destinationAccountId = null;
              updatedTx.tempInvestmentId = null;
              updatedTx.tempLoanId = null;
              updatedTx.tempVehicleOperation = null;
              updatedTx.tempParcelaId = null;
          } else {
              updatedTx.isTransfer = false;
              updatedTx.destinationAccountId = null;
          }
          
          break;
        }
      }
      return updatedTx;
    });
  }, []);

  const processStatementFile = useCallback(async (file: File, accountId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const content = await file.text();
      let rawTransactions: ImportedTransaction[] = [];
      
      if (content.toLowerCase().includes('<ofx>')) {
        rawTransactions = parseOFX(content, accountId);
      } else if (file.name.toLowerCase().endsWith('.csv') || content.includes('\t') || content.includes(',')) {
        rawTransactions = parseCSV(content, accountId);
      } else {
        return { success: false, message: "Formato de arquivo não reconhecido. Use .csv ou .ofx." };
      }
      
      if (rawTransactions.length === 0) {
        return { success: false, message: "Nenhuma transação válida encontrada no arquivo." };
      }
      
      const processedTransactions = applyRules(rawTransactions, standardizationRules);
      
      const dates = processedTransactions.map(t => parseDateLocal(t.date)).sort((a, b) => a.getTime() - b.getTime());
      const startDate = dates[0] ? format(dates[0], 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
      const endDate = dates[dates.length - 1] ? format(dates[dates.length - 1], 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
      
      const newStatement: ImportedStatement = {
          id: generateStatementId(),
          accountId,
          fileName: file.name,
          importDate: new Date().toISOString(),
          startDate,
          endDate,
          status: 'pending',
          rawTransactions: processedTransactions,
      };
      
      setImportedStatements(prev => [...prev, newStatement]);
      
      return { success: true, message: `${processedTransactions.length} transações carregadas do extrato ${file.name}.` };
      
    } catch (e: any) {
      console.error("Parsing Error:", e);
      return { success: false, message: e.message || "Erro ao processar o arquivo. Verifique o formato." };
    }
  }, [standardizationRules, applyRules]);

  const deleteImportedStatement = useCallback((statementId: string) => {
    setImportedStatements(prev => prev.filter(s => s.id !== statementId));
  }, []);
  
  const updateImportedStatement = useCallback((statementId: string, updates: Partial<ImportedStatement>) => {
    setImportedStatements(prev => prev.map(s => s.id === statementId ? { ...s, ...updates } : s));
  }, []);
  
  const uncontabilizeImportedTransaction = useCallback((transactionId: string) => {
    setImportedStatements(prev => prev.map(s => {
        let updated = false;
        const newRawTransactions = s.rawTransactions.map(t => {
            if (t.contabilizedTransactionId === transactionId) {
                updated = true;
                return {
                    ...t,
                    isContabilized: false,
                    contabilizedTransactionId: undefined,
                    categoryId: null,
                    operationType: null,
                    description: t.originalDescription,
                    isTransfer: false,
                    destinationAccountId: null,
                    tempInvestmentId: null,
                    tempLoanId: null,
                    tempParcelaId: null,
                    tempVehicleOperation: null,
                };
            }
            return t;
        });
        
        if (updated) {
            const pendingCount = newRawTransactions.filter(t => !t.isContabilized).length;
            const newStatus = pendingCount === 0 ? 'complete' : 'partial';
            return { ...s, rawTransactions: newRawTransactions, status: newStatus };
        }
        return s;
    }));
  }, []);
  
  const getTransactionsForReview = useCallback((accountId: string, range: DateRange): ImportedTransaction[] => {
    const allRawTransactions: ImportedTransaction[] = [];
    
    importedStatements
        .filter(s => s.accountId === accountId)
        .forEach(s => {
            s.rawTransactions
                .filter(t => !t.isContabilized)
                .forEach(t => allRawTransactions.push(t));
        });
        
    if (!range.from || !range.to) return allRawTransactions;
    
    const rangeFrom = startOfDay(range.from);
    const rangeTo = endOfDay(range.to);
    
    let filteredTxs = allRawTransactions.filter(t => {
        const transactionDate = parseDateLocal(t.date);
        return isWithinInterval(transactionDate, { start: rangeFrom, end: rangeTo });
    });
    
    filteredTxs = applyRules(filteredTxs, standardizationRules);
    
    const deduplicatedTxs = filteredTxs.map(importedTx => {
        const isDuplicate = transacoesV2.find(manualTx => {
            const isSameAccount = manualTx.accountId === importedTx.accountId;
            const isSameAmount = Math.abs(manualTx.amount - importedTx.amount) < 0.01;
            
            const importedFlow = getFlowTypeFromOperation(importedTx.operationType || 'despesa');
            
            const isSameFlow = (manualTx.flow === 'in' || manualTx.flow === 'transfer_in') === (importedFlow === 'in' || importedFlow === 'transfer_in');
            
            const importedDate = parseDateLocal(importedTx.date);
            const manualDate = parseDateLocal(manualTx.date);
            const isSameDayOrAdjacent = Math.abs(differenceInDays(importedDate, manualDate)) <= 1;
            
            const isInitialBalance = manualTx.operationType === 'initial_balance';
            
            return isSameAccount && isSameAmount && isSameFlow && isSameDayOrAdjacent && !isInitialBalance;
        });
        
        if (isDuplicate) {
            return {
                ...importedTx,
                isPotentialDuplicate: true,
                duplicateOfTxId: isDuplicate.id,
                operationType: isDuplicate.operationType,
                categoryId: isDuplicate.categoryId,
                description: isDuplicate.description,
            };
        }
        
        return importedTx;
    });
    
    return deduplicatedTxs;
  }, [importedStatements, transacoesV2, standardizationRules, applyRules]);

  const updateBill = useCallback((id: string, updates: Partial<BillTracker>) => {
    setBillsTracker(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setBillsTracker(prev => prev.filter(b => b.id !== id));
  }, []);
  
  const getRevenueForPreviousMonth = useCallback((date: Date): number => {
    const prevMonth = subMonths(date, 1);
    const prevMonthYear = format(prevMonth, 'yyyy-MM');
    
    return transacoesV2.filter(t => 
        (t.operationType === 'receita' || t.operationType === 'rendimento') && 
        t.date.startsWith(prevMonthYear)
    ).reduce((acc, t) => acc + t.amount, 0);
}, [transacoesV2]);

  const getBillsForMonth = useCallback((date: Date): BillTracker[] => {
    
    const filteredBills = billsTracker.filter(bill => {
        const billDueDate = parseDateLocal(bill.dueDate);
        const isSameMonthDate = isSameMonth(billDueDate, date);
        
        let isPaidInMonth = false;
        if (bill.isPaid && bill.paymentDate) {
            const billPaymentDate = parseDateLocal(bill.paymentDate);
            isPaidInMonth = isSameMonth(billPaymentDate, date);
        }
        
        return isSameMonthDate || isPaidInMonth;
    });
    
    const finalBills = filteredBills.filter(b => !b.isExcluded || b.isPaid);
    
    return finalBills.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
  }, [billsTracker]);
  
  const getPotentialFixedBillsForMonth = useCallback((date: Date, localBills: BillTracker[]): PotentialFixedBill[] => {
    const potentialBills: PotentialFixedBill[] = [];
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    const isBillIncluded = (sourceType: BillSourceType, sourceRef: string, parcelaNumber: number) => {
        return localBills.some(b => 
            b.sourceType === sourceType && 
            b.sourceRef === sourceRef && 
            b.parcelaNumber === parcelaNumber &&
            !b.isExcluded
        );
    };
    
    emprestimos.filter(e => e.status === 'ativo').forEach(loan => {
        if (!loan.dataInicio || loan.meses === 0) return;
        
        const schedule = calculateLoanSchedule(loan.id);
        
        schedule.forEach(item => {
            const dueDate = getDueDate(loan.dataInicio!, item.parcela);
            
            const isDueInMonth = isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
            
            const isPaid = transacoesV2.some(t => 
                t.operationType === 'pagamento_emprestimo' && 
                t.links?.loanId === `loan_${loan.id}` &&
                t.links?.parcelaId === String(item.parcela)
            );
            
            if (isDueInMonth || isPaid) {
                const sourceRef = String(loan.id);
                
                potentialBills.push({
                    key: `loan_${sourceRef}_${item.parcela}`,
                    sourceType: 'loan_installment',
                    sourceRef,
                    parcelaNumber: item.parcela,
                    dueDate: format(dueDate, 'yyyy-MM-dd'),
                    expectedAmount: loan.parcela,
                    description: `Empréstimo ${loan.contrato} - Parcela ${item.parcela}/${loan.meses}`,
                    isPaid,
                    isIncluded: isBillIncluded('loan_installment', sourceRef, item.parcela),
                });
            }
        });
    });
    
    segurosVeiculo.forEach(seguro => {
        seguro.parcelas.forEach(parcela => {
            const dueDate = parseDateLocal(parcela.vencimento);
            
            const isDueInMonth = isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
            
            if (isDueInMonth || parcela.paga) {
                const sourceRef = String(seguro.id);
                
                potentialBills.push({
                    key: `insurance_${sourceRef}_${parcela.numero}`,
                    sourceType: 'insurance_installment',
                    sourceRef,
                    parcelaNumber: parcela.numero,
                    dueDate: parcela.vencimento,
                    expectedAmount: parcela.valor,
                    description: `Seguro ${seguro.numeroApolice} - Parcela ${parcela.numero}/${seguro.numeroParcelas}`,
                    isPaid: parcela.paga,
                    isIncluded: isBillIncluded('insurance_installment', sourceRef, parcela.numero),
                });
            }
        });
    });
    
    return potentialBills.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
  }, [emprestimos, segurosVeiculo, transacoesV2, calculateLoanSchedule]);
  
  const getFutureFixedBills = useCallback((referenceDate: Date, localBills: BillTracker[]): PotentialFixedBill[] => {
    const futureBills: PotentialFixedBill[] = [];
    
    const referenceMonthEnd = endOfMonth(referenceDate);
    
    const isBillIncluded = (sourceType: BillSourceType, sourceRef: string, parcelaNumber: number) => {
        return localBills.some(b => 
            b.sourceType === sourceType && 
            b.sourceRef === sourceRef && 
            b.parcelaNumber === parcelaNumber &&
            !b.isExcluded
        );
    };
    
    emprestimos.filter(e => e.status === 'ativo').forEach(loan => {
        if (!loan.dataInicio || loan.meses === 0) return;
        
        const schedule = calculateLoanSchedule(loan.id);
        
        schedule.forEach(item => {
            const dueDate = getDueDate(loan.dataInicio!, item.parcela);
            
            if (isAfter(dueDate, referenceMonthEnd)) {
                const isPaid = transacoesV2.some(t => 
                    t.operationType === 'pagamento_emprestimo' &&
                    t.links?.loanId === `loan_${loan.id}` &&
                    t.links?.parcelaId === String(item.parcela)
                );
                
                const sourceRef = String(loan.id);
                
                futureBills.push({
                    key: `loan_${sourceRef}_${item.parcela}`,
                    sourceType: 'loan_installment',
                    sourceRef,
                    parcelaNumber: item.parcela,
                    dueDate: format(dueDate, 'yyyy-MM-dd'),
                    expectedAmount: loan.parcela,
                    description: `Empréstimo ${loan.contrato} - Parcela ${item.parcela}/${loan.meses}`,
                    isPaid: isPaid,
                    isIncluded: isBillIncluded('loan_installment', sourceRef, item.parcela),
                });
            }
        });
    });
    
    segurosVeiculo.forEach(seguro => {
        seguro.parcelas.forEach(parcela => {
            const dueDate = parseDateLocal(parcela.vencimento);
            
            if (isAfter(dueDate, referenceMonthEnd)) {
                
                const sourceRef = String(seguro.id);
                
                futureBills.push({
                    key: `insurance_${sourceRef}_${parcela.numero}`,
                    sourceType: 'insurance_installment',
                    sourceRef,
                    parcelaNumber: parcela.numero,
                    dueDate: parcela.vencimento,
                    expectedAmount: parcela.valor,
                    description: `Seguro ${seguro.numeroApolice} - Parcela ${parcela.numero}/${seguro.numeroParcelas}`,
                    isPaid: parcela.paga,
                    isIncluded: isBillIncluded('insurance_installment', sourceRef, parcela.numero),
                });
            }
        });
    });
    
    return futureBills.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
  }, [emprestimos, segurosVeiculo, transacoesV2, calculateLoanSchedule]);

  const addEmprestimo = (emprestimo: Omit<Emprestimo, "id">) => {
    const newId = Math.max(0, ...emprestimos.map(e => e.id)) + 1;
    setEmprestimos([...emprestimos, { ...emprestimo, id: newId, status: emprestimo.status || 'ativo', parcelasPagas: 0 }]);
  };

  const updateEmprestimo = (id: number, updates: Partial<Emprestimo>) => {
    setEmprestimos(emprestimos.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEmprestimo = (id: number) => {
    setEmprestimos(emprestimos.filter(e => e.id !== id));
  };

  const getPendingLoans = useCallback(() => {
    return emprestimos.filter(e => e.status === 'pendente_config');
  }, [emprestimos]);

  const markLoanParcelPaid = useCallback((loanId: number, valorPago: number, dataPagamento: string, parcelaNumero?: number) => {
    setEmprestimos(prev => prev.map(e => {
      if (e.id !== loanId) return e;
      
      return {
        ...e,
        status: 'ativo',
      };
    }));
  }, []);
  
  const unmarkLoanParcelPaid = useCallback((loanId: number) => {
    setEmprestimos(prev => prev.map(e => {
      if (e.id !== loanId) return e;
      
      return {
        ...e,
        status: 'ativo',
      };
    }));
  }, []);

  const addVeiculo = (veiculo: Omit<Veiculo, "id">) => {
    const newId = Math.max(0, ...veiculos.map(v => v.id)) + 1;
    setVeiculos([...veiculos, { ...veiculo, id: newId, status: veiculo.status || 'ativo' }]);
  };

  const updateVeiculo = (id: number, updates: Partial<Veiculo>) => {
    setVeiculos(veiculos.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVeiculo = (id: number) => {
    setVeiculos(veiculos.filter(v => v.id !== id));
  };

  const getPendingVehicles = useCallback(() => {
    return veiculos.filter(v => v.status === 'pendente_cadastro');
  }, [veiculos]);

  const addSeguroVeiculo = (seguro: Omit<SeguroVeiculo, "id">) => {
    const newId = Math.max(0, ...segurosVeiculo.map(s => s.id)) + 1;
    setSegurosVeiculo([...segurosVeiculo, { ...seguro, id: newId }]);
  };

  const updateSeguroVeiculo = (id: number, updates: Partial<SeguroVeiculo>) => {
    setSegurosVeiculo(segurosVeiculo.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSeguroVeiculo = (id: number) => {
    setSegurosVeiculo(segurosVeiculo.filter(s => s.id !== id));
  };
  
  const markSeguroParcelPaid = useCallback((seguroId: number, parcelaNumero: number, transactionId: string) => {
    setSegurosVeiculo(prevSeguros => prevSeguros.map(seguro => {
      if (seguro.id !== seguroId) return seguro;
      
      const updatedParcelas = seguro.parcelas.map(parcela => {
        if (parcela.numero === parcelaNumero) {
          return { ...parcela, paga: true, transactionId };
        }
        return parcela;
      });
      
      return { ...seguro, parcelas: updatedParcelas };
    }));
  }, []);
  
  const unmarkSeguroParcelPaid = useCallback((seguroId: number, parcelaNumero: number) => {
    setSegurosVeiculo(prevSeguros => prevSeguros.map(seguro => {
      if (seguro.id !== seguroId) return seguro;
      
      const updatedParcelas = seguro.parcelas.map(parcela => {
        if (parcela.numero === parcelaNumero) {
          return { ...parcela, paga: false, transactionId: undefined };
        }
        return parcela;
      });
      
      return { ...seguro, parcelas: updatedParcelas };
    }));
  }, []);

  const addObjetivo = (obj: Omit<ObjetivoFinanceiro, "id">) => {
    const newId = Math.max(0, ...objetivos.map(o => o.id)) + 1;
    setObjetivos([...objetivos, { ...obj, id: newId }]);
  };

  const updateObjetivo = (id: number, updates: Partial<ObjetivoFinanceiro>) => {
    setObjetivos(objetivos.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObjetivo = (id: number) => {
    setObjetivos(objetivos.filter(o => o.id !== id));
  };

  const addTransacaoV2 = (transaction: TransacaoCompleta) => {
    setTransacoesV2(prev => [...prev, transaction]);
  };
  
  const addStandardizationRule = useCallback((rule: Omit<StandardizationRule, "id">) => {
    const newRule: StandardizationRule = {
        ...rule,
        id: generateRuleId(),
    };
    setStandardizationRules(prev => [...prev, newRule]);
  }, []);

  const deleteStandardizationRule = useCallback((id: string) => {
    setStandardizationRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const getContasCorrentesTipo = useCallback(() => {
    return contasMovimento.filter(c => c.accountType === 'corrente');
  }, [contasMovimento]);
  
  const getTotalReceitas = (mes?: string): number => {
    const receitas = transacoesV2.filter(t => {
      const isReceita = t.operationType === 'receita' || t.operationType === 'rendimento';
      if (!mes) return isReceita;
      return isReceita && t.date.startsWith(mes);
    });
    return receitas.reduce((acc, t) => acc + t.amount, 0);
  };

  const getTotalDespesas = (mes?: string): number => {
    const despesas = transacoesV2.filter(t => {
      const isDespesa = t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo';
      if (!mes) return isDespesa;
      return isDespesa && t.date.startsWith(mes);
    });
    return despesas.reduce((acc, t) => acc + t.amount, 0);
  };

  const getTotalDividas = () => {
    return emprestimos.reduce((acc, e) => acc + e.valorTotal, 0);
  };

  const getCustoVeiculos = () => {
    return veiculos.filter(v => v.status !== 'vendido').reduce((acc, v) => acc + v.valorSeguro, 0);
  };

  const getSaldoAtual = useCallback(() => {
    let totalBalance = 0;

    contasMovimento.forEach(conta => {
      const balance = calculateBalanceUpToDate(conta.id, undefined, transacoesV2, contasMovimento);
      
      totalBalance += balance;
    });

    return totalBalance;
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);

  const getValorFipeTotal = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date(9999, 11, 31);
    return veiculos
        .filter(v => v.status !== 'vendido' && parseDateLocal(v.dataCompra) <= date)
        .reduce((acc, v) => acc + v.valorFipe, 0);
  }, [veiculos]);

  const getLoanPrincipalRemaining = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date(9999, 11, 31);

    return emprestimos.reduce((acc, e) => {
      if (e.status === 'quitado' || e.status === 'pendente_config') return acc;
      
      const paidUpToDate = calculatePaidInstallmentsUpToDate(e.id, date);
      let currentSaldo = e.valorTotal;
      
      if (paidUpToDate > 0) {
          const schedule = calculateLoanSchedule(e.id);
          const lastPaidItem = schedule.find(item => item.parcela === paidUpToDate);
          if (lastPaidItem) {
              currentSaldo = lastPaidItem.saldoDevedor;
          }
      }
      
      return acc + Math.max(0, currentSaldo);
    }, 0);
  }, [emprestimos, calculatePaidInstallmentsUpToDate, calculateLoanSchedule]);

  const getCreditCardDebt = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date(9999, 11, 31);

    return contasMovimento
      .filter(c => c.accountType === 'cartao_credito')
      .reduce((acc, c) => {
        const balance = calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento);
        return acc + Math.abs(Math.min(0, balance));
      }, 0);
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);

  const getSaldoDevedor = useCallback((targetDate?: Date) => {
    const saldoEmprestimos = getLoanPrincipalRemaining(targetDate);
    const saldoCartoes = getCreditCardDebt(targetDate);
    return saldoEmprestimos + saldoCartoes;
  }, [getLoanPrincipalRemaining, getCreditCardDebt]);

  const getJurosTotais = () => {
    return emprestimos.reduce((acc, e) => {
      const custoTotal = e.parcela * e.meses;
      const juros = custoTotal - e.valorTotal;
      return acc + juros;
    }, 0);
  };

  const getDespesasFixas = () => {
    const despesasFixas = transacoesV2.filter(t => {
      const category = categoriasV2.find(c => c.id === t.categoryId);
      return category?.nature === 'despesa_fixa';
    });
    return despesasFixas.reduce((acc, t) => acc + t.amount, 0);
  };

  const getAtivosTotal = useCallback((targetDate?: Date) => {
    const date = targetDate || new Date(9999, 11, 31);

    const saldoContasAtivas = contasMovimento
      .filter(c => c.accountType !== 'cartao_credito')
      .reduce((acc, c) => {
        const balance = calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento);
        return acc + Math.max(0, balance);
      }, 0);
      
    const valorVeiculos = getValorFipeTotal(date);
    const segurosAApropriar = getSegurosAApropriar(date); 
                          
    return saldoContasAtivas + valorVeiculos + segurosAApropriar; 
  }, [contasMovimento, transacoesV2, getValorFipeTotal, calculateBalanceUpToDate, getSegurosAApropriar]); 

  const getPassivosTotal = useCallback((targetDate?: Date) => {
    const saldoDevedor = getSaldoDevedor(targetDate);
    const segurosAPagar = getSegurosAPagar(targetDate); 
    
    return saldoDevedor + segurosAPagar; 
  }, [getSaldoDevedor, getSegurosAPagar]); 

  const getPatrimonioLiquido = useCallback((targetDate?: Date) => {
    return getAtivosTotal(targetDate) - getPassivosTotal(targetDate);
  }, [getAtivosTotal, getPassivosTotal]);
  
  const getTransactionsForMonth = useCallback((date: Date): TransacaoCompleta[] => {
    const monthYear = format(date, 'yyyy-MM');
    return transacoesV2.filter(t => t.date.startsWith(monthYear));
  }, [transacoesV2]);

  const exportData = () => {
    const data: FinanceExportV2 = {
      schemaVersion: "2.0",
      exportedAt: new Date().toISOString(),
      data: {
        accounts: contasMovimento,
        categories: categoriasV2,
        transactions: transacoesV2,
        transferGroups: [],
        
        emprestimos,
        veiculos,
        segurosVeiculo,
        objetivos,
        billsTracker,
        standardizationRules,
        importedStatements,
        
        monthlyRevenueForecast,
        alertStartDate,
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File): Promise<{ success: boolean; message: string }> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.schemaVersion === '2.0' && data.data) {
        if (data.data.accounts) {
            setContasMovimento(data.data.accounts);
        }
        if (data.data.categories) setCategoriasV2(data.data.categories);
        if (data.data.transactions) setTransacoesV2(data.data.transactions);
        
        if (data.data.emprestimos) setEmprestimos(data.data.emprestimos);
        if (data.data.veiculos) setVeiculos(data.data.veiculos);
        if (data.data.segurosVeiculo) setSegurosVeiculo(data.data.segurosVeiculo);
        if (data.data.objetivos) setObjetivos(data.data.objetivos);
        if (data.data.billsTracker) setBillsTracker(data.data.billsTracker);
        if (data.data.standardizationRules) setStandardizationRules(data.data.standardizationRules);
        if (data.data.importedStatements) setImportedStatements(data.data.importedStatements);
        
        if (data.data.monthlyRevenueForecast !== undefined) setMonthlyRevenueForecast(data.data.monthlyRevenueForecast);
        if (data.data.alertStartDate) setAlertStartDate(data.data.alertStartDate);
        
        return { success: true, message: "Dados V2 importados com sucesso!" };
      } else {
        return { success: false, message: "Erro ao importar dados. Versão do schema incompatível." };
      }
    } catch (error) {
      return { success: false, message: "Erro ao importar dados. Verifique o formato do arquivo." };
    }
  };

  const value: FinanceContextType = {
    emprestimos,
    addEmprestimo,
    updateEmprestimo,
    deleteEmprestimo,
    getPendingLoans,
    markLoanParcelPaid,
    unmarkLoanParcelPaid,
    calculateLoanSchedule, 
    calculateLoanAmortizationAndInterest, 
    calculateLoanPrincipalDueInNextMonths, 
    veiculos,
    addVeiculo,
    updateVeiculo,
    deleteVeiculo,
    getPendingVehicles,
    segurosVeiculo,
    addSeguroVeiculo,
    updateSeguroVeiculo,
    deleteSeguroVeiculo,
    markSeguroParcelPaid,
    unmarkSeguroParcelPaid,
    objetivos,
    addObjetivo,
    updateObjetivo,
    deleteObjetivo,
    
    billsTracker,
    setBillsTracker,
    updateBill,
    deleteBill,
    getBillsForMonth,
    getPotentialFixedBillsForMonth,
    getFutureFixedBills,
    
    contasMovimento,
    setContasMovimento,
    getContasCorrentesTipo,
    categoriasV2,
    setCategoriasV2,
    transacoesV2,
    setTransacoesV2,
    addTransacaoV2,
    
    standardizationRules,
    addStandardizationRule,
    deleteStandardizationRule,
    
    importedStatements,
    processStatementFile,
    deleteImportedStatement,
    getTransactionsForReview,
    updateImportedStatement,
    uncontabilizeImportedTransaction,
    
    dateRanges,
    setDateRanges,
    
    alertStartDate,
    setAlertStartDate,
    
    monthlyRevenueForecast,
    setMonthlyRevenueForecast,
    getRevenueForPreviousMonth,
    
    getTotalReceitas,
    getTotalDespesas,
    getTotalDividas,
    getCustoVeiculos,
    getSaldoAtual,
    getValorFipeTotal,
    getSaldoDevedor,
    getLoanPrincipalRemaining, 
    getCreditCardDebt, 
    getJurosTotais,
    getDespesasFixas,
    getPatrimonioLiquido,
    getAtivosTotal,
    getPassivosTotal,
    getSegurosAApropriar, 
    getSegurosAPagar, 
    calculateBalanceUpToDate, 
    calculateTotalInvestmentBalanceAtDate,
    calculatePaidInstallmentsUpToDate,
    getTransactionsForMonth,
    exportData,
    importData,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error("useFinance deve ser usado dentro de um FinanceProvider");
  }
  return context;
}