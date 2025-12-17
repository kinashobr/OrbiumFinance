import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Wallet, PiggyBank, TrendingUp, Shield, Target, Bitcoin, CreditCard, ArrowLeftRight, Car, DollarSign, Plus, Minus, RefreshCw, Coins, TrendingDown, Tags, Calendar, CheckCircle2, Info } from "lucide-react";
import { ContaCorrente, Categoria, AccountType, ACCOUNT_TYPE_LABELS, generateTransactionId, formatCurrency, OperationType, TransacaoCompleta, TransactionLinks, generateTransferGroupId, getFlowTypeFromOperation, getDomainFromOperation, InvestmentInfo, SeguroVeiculo, Veiculo, OPERATION_TYPE_LABELS } from "@/types/finance";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";

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

interface MovimentarContaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ContaCorrente[];
  categories: Categoria[];
  investments: InvestmentInfo[];
  loans: LoanInfo[];
  segurosVeiculo: SeguroVeiculo[];
  veiculos: Veiculo[];
  selectedAccountId?: string;
  onSubmit: (transaction: TransacaoCompleta, transferGroup?: { id: string; fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string }) => void;
  editingTransaction?: TransacaoCompleta;
}

// --- Helper Functions for Styling and Formatting ---

const OPERATION_COLOR_MAP = {
  receita: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200', iconBg: 'bg-green-600' },
  despesa: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', iconBg: 'bg-red-600' },
  transferencia: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', iconBg: 'bg-blue-600' },
  aplicacao: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', iconBg: 'bg-purple-600' },
  resgate: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', iconBg: 'bg-amber-600' },
  pagamento_emprestimo: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', iconBg: 'bg-orange-600' },
  liberacao_emprestimo: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', iconBg: 'bg-emerald-600' },
  veiculo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', iconBg: 'bg-indigo-600' },
  rendimento: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200', iconBg: 'bg-teal-600' },
  initial_balance: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', iconBg: 'bg-gray-600' },
};

const getOperationColor = (operationType: OperationType | null, type: 'bg' | 'text' | 'border' | 'iconBg') => {
  const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', iconBg: 'bg-gray-600' };
  if (!operationType) return defaultColor[type];
  return OPERATION_COLOR_MAP[operationType]?.[type] || defaultColor[type];
};

const getAccountColor = (accountType: AccountType | undefined, type: 'bg' | 'text') => {
  const colors = {
    corrente: { bg: 'bg-blue-600', text: 'text-blue-600' },
    renda_fixa: { bg: 'bg-purple-600', text: 'text-purple-600' },
    poupanca: { bg: 'bg-teal-600', text: 'text-teal-600' },
    cripto: { bg: 'bg-yellow-600', text: 'text-yellow-600' },
    reserva: { bg: 'bg-green-600', text: 'text-green-600' },
    objetivo: { bg: 'bg-pink-600', text: 'text-pink-600' },
    cartao_credito: { bg: 'bg-red-600', text: 'text-red-600' },
  };
  const defaultColor = { bg: 'bg-gray-600', text: 'text-gray-600' };
  return accountType ? colors[accountType]?.[type] || defaultColor[type] : defaultColor[type];
};

const formatToBR = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseFromBR = (value: string) => {
  let cleaned = value.replace(/[^\d,.-]/g, '');
  const isNegative = cleaned.startsWith('-');
  
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  
  let parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  
  return isNegative ? -parsed : parsed;
};

// --- Component Definition ---

export function MovimentarContaModal({
  open,
  onOpenChange,
  accounts,
  categories,
  investments,
  loans,
  segurosVeiculo,
  veiculos,
  selectedAccountId,
  onSubmit,
  editingTransaction,
}: MovimentarContaModalProps) {
  const [accountId, setAccountId] = useState(selectedAccountId || accounts[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState("");
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [tempInvestmentId, setTempInvestmentId] = useState<string | null>(null);
  const [tempLoanId, setTempLoanId] = useState<string | null>(null);
  const [tempVehicleOperation, setTempVehicleOperation] = useState<'compra' | 'venda' | null>(null);
  const [tempTipoVeiculo, setTempTipoVeiculo] = useState<'carro' | 'moto' | 'caminhao'>('carro');
  const [tempNumeroContrato, setTempNumeroContrato] = useState<string>('');
  const [tempParcelaId, setTempParcelaId] = useState<string | null>(null);
  
  const [tempSeguroId, setTempSeguroId] = useState<string | null>(null);
  const [tempSeguroParcelaId, setTempSeguroParcelaId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'simples' | 'vinculo'>('simples');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchCategory, setSearchCategory] = useState('');
  
  const isEditing = !!editingTransaction;
  const selectedAccount = accounts.find(a => a.id === accountId);
  const availableOperations = selectedAccount ? getAvailableOperationTypes(selectedAccount.accountType) : [];
  
  const isTransfer = operationType === 'transferencia';
  const isInvestmentFlow = operationType === 'aplicacao' || operationType === 'resgate';
  const isLoanPayment = operationType === 'pagamento_emprestimo';
  const isLoanLiberation = operationType === 'liberacao_emprestimo';
  const isVehicle = operationType === 'veiculo';
  const isFinancingFlow = isLoanPayment || isLoanLiberation;
  
  const seguroCategory = useMemo(() => categories.find(c => c.label.toLowerCase() === 'seguro'), [categories]);
  const isInsurancePayment = operationType === 'despesa' && categoryId === seguroCategory?.id;
  
  const isCategorizable = operationType === 'receita' || operationType === 'despesa' || operationType === 'rendimento';
  const isCategoryDisabled = !isCategorizable && !isInsurancePayment;
  
  const isVinculoRequired = isTransfer || isInvestmentFlow || isFinancingFlow || isVehicle || isInsurancePayment;
  
  const availableCategories = useMemo(() => getCategoryOptions(operationType, categories), [operationType, categories]);
  
  const selectedOperationConfig = OPERATION_CONFIG[operationType || 'despesa'];
  const HeaderIcon = selectedOperationConfig?.icon || DollarSign;
  
  const isAmountAutoFilled = (isLoanPayment && tempLoanId && tempParcelaId) || (isInsurancePayment && tempSeguroId && tempSeguroParcelaId);
  
  const activeLoans = useMemo(() => loans.filter(l => l.id.startsWith('loan_')), [loans]);
  
  const availableSeguros = useMemo(() => {
      return segurosVeiculo.filter(s => {
          const vehicle = veiculos.find(v => v.id === s.veiculoId);
          return vehicle && vehicle.status === 'ativo';
      });
  }, [segurosVeiculo, veiculos]);
  
  const availableSeguroParcelas = useMemo(() => {
      if (!tempSeguroId) return [];
      const seguro = segurosVeiculo.find(s => s.id === parseInt(tempSeguroId));
      if (!seguro) return [];
      
      return seguro.parcelas.filter(p => !p.paga);
  }, [tempSeguroId, segurosVeiculo]);
  
  const availableInstallments = useMemo(() => {
    if (!tempLoanId) return [];
    const loan = loans.find(l => l.id === tempLoanId);
    if (!loan) return [];
    
    return loan.parcelas.filter(p => !p.paga);
  }, [tempLoanId, loans]);
  
  const filteredCategories = useMemo(() => {
    if (!searchCategory) return availableCategories;
    const lowerCaseSearch = searchCategory.toLowerCase();
    return availableCategories.filter(c => c.label.toLowerCase().includes(lowerCaseSearch));
  }, [availableCategories, searchCategory]);
  
  const currentBalance = useMemo(() => {
    // Placeholder for current balance, assuming the account object has a 'balance' property
    return selectedAccount?.initialBalance || 0; 
  }, [selectedAccount]);

  // --- Validation Logic ---
  const validationErrors = useMemo(() => {
    const parsedAmount = parseFromBR(amount);
    
    const errors = {
      amount: parsedAmount <= 0,
      account: !accountId,
      operation: !operationType,
      category: isCategorizable && !isInsurancePayment && !categoryId,
      transfer: isTransfer && !destinationAccountId,
      investment: isInvestmentFlow && !tempInvestmentId,
      loanPayment: isLoanPayment && (!tempLoanId || !tempParcelaId),
      loanLiberation: isLoanLiberation && !tempNumeroContrato,
      vehicle: isVehicle && !tempVehicleOperation,
      insurancePayment: isInsurancePayment && (!tempSeguroId || !tempSeguroParcelaId),
    };
    
    return errors;
  }, [amount, accountId, operationType, isCategorizable, isInsurancePayment, categoryId, isTransfer, destinationAccountId, isInvestmentFlow, tempInvestmentId, isLoanPayment, tempLoanId, tempParcelaId, isLoanLiberation, tempNumeroContrato, isVehicle, tempVehicleOperation, tempSeguroId, tempSeguroParcelaId]);

  const isValid = useMemo(() => !Object.values(validationErrors).some(error => error), [validationErrors]);

  // --- Effects ---
  
  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        setAccountId(editingTransaction.accountId);
        setDate(editingTransaction.date);
        setAmount(formatToBR(editingTransaction.amount));
        setOperationType(editingTransaction.operationType);
        setCategoryId(editingTransaction.categoryId);
        setDescription(editingTransaction.description);
        
        setDestinationAccountId(editingTransaction.links?.transferGroupId ? accounts.find(a => a.id !== editingTransaction.accountId && a.id === editingTransaction.links?.investmentId)?.id || null : null);
        setTempInvestmentId(editingTransaction.links?.investmentId || null);
        setTempLoanId(editingTransaction.links?.loanId || null);
        setTempParcelaId(editingTransaction.links?.parcelaId || null);
        setTempVehicleOperation(editingTransaction.meta?.vehicleOperation || null);
        setTempTipoVeiculo(editingTransaction.meta?.tipoVeiculo || 'carro');
        setTempNumeroContrato(editingTransaction.meta?.numeroContrato || '');
        
        if (editingTransaction.links?.vehicleTransactionId) {
            const [seguroIdStr, parcelaNumStr] = editingTransaction.links.vehicleTransactionId.split('_');
            setTempSeguroId(seguroIdStr || null);
            setTempSeguroParcelaId(parcelaNumStr || null);
        } else {
            setTempSeguroId(null);
            setTempSeguroParcelaId(null);
        }
        
      } else {
        setAccountId(selectedAccountId || accounts[0]?.id || '');
        setDate(new Date().toISOString().split('T')[0]);
        setAmount("");
        const initialAccountOps = getAvailableOperationTypes(accounts.find(a => a.id === (selectedAccountId || accounts[0]?.id))?.accountType || 'corrente');
        setOperationType(initialAccountOps[0] || null); 
        setCategoryId(null);
        setDescription("");
        
        setDestinationAccountId(null);
        setTempInvestmentId(null);
        setTempLoanId(null);
        setTempParcelaId(null);
        setTempVehicleOperation(null);
        setTempNumeroContrato('');
        setTempSeguroId(null); 
        setTempSeguroParcelaId(null); 
      }
      setActiveTab(isVinculoRequired ? "vinculo" : "simples");
    }
  }, [open, editingTransaction, selectedAccountId, accounts]);

  useEffect(() => {
    if (selectedAccount && !isEditing) {
      if (!operationType || !availableOperations.includes(operationType)) {
        setOperationType(availableOperations[0] || null);
      }
    }
  }, [selectedAccount, availableOperations, isEditing, operationType]);
  
  useEffect(() => {
    if (isLoanPayment && tempLoanId && tempParcelaId) {
      const loan = loans.find(l => l.id === tempLoanId);
      const parcela = loan?.parcelas.find(p => p.numero === parseInt(tempParcelaId));
      
      if (parcela) {
        setAmount(formatToBR(parcela.valor));
        setDescription(`Pagamento Empréstimo ${loan?.numeroContrato || 'N/A'} - Parcela ${parcela.numero}/${loan?.totalParcelas || 'N/A'}`);
      }
    }
  }, [isLoanPayment, tempLoanId, tempParcelaId, loans]);
  
  useEffect(() => {
    if (isInsurancePayment && tempSeguroId && tempSeguroParcelaId) {
      const seguro = segurosVeiculo.find(s => s.id === parseInt(tempSeguroId));
      const parcela = seguro?.parcelas.find(p => p.numero === parseInt(tempSeguroParcelaId));
      
      if (parcela) {
        setAmount(formatToBR(parcela.valor));
        setDescription(`Pagamento Seguro ${seguro?.numeroApolice || 'N/A'} - Parcela ${parcela.numero}/${seguro?.numeroParcelas || 'N/A'}`);
      }
    }
  }, [isInsurancePayment, tempSeguroId, tempSeguroParcelaId, segurosVeiculo]);
  
  useEffect(() => {
    if (categoryId && !description && isCategorizable) {
      const category = categories.find(c => c.id === categoryId);
      if (category?.label) {
        setDescription(category.label);
      }
    }
  }, [categoryId, categories, description, isCategorizable]);

  const handleAmountChange = (value: string) => {
    if (isAmountAutoFilled) return;
    
    let cleaned = value.replace(/[^\d,.-]/g, '');
    
    const parts = cleaned.split(/[,.]/);
    if (parts.length > 2) {
      cleaned = parts.slice(0, -1).join('') + '.' + parts.slice(-1);
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        const lastPart = parts.pop();
        cleaned = parts.join('') + '.' + lastPart;
      }
    }
    
    setAmount(cleaned);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
        toast.error("Preencha todos os campos obrigatórios ou revise os vínculos.");
        return;
    }
    
    setIsSubmitting(true);
    
    const parsedAmount = parseFromBR(amount);
    const flow = getFlowTypeFromOperation(operationType!, isVehicle ? tempVehicleOperation || undefined : undefined);
    const domain = getDomainFromOperation(operationType!);
    
    const baseTx: TransacaoCompleta = {
      id: editingTransaction?.id || generateTransactionId(),
      date,
      accountId,
      flow,
      operationType: operationType!,
      domain,
      amount: parsedAmount,
      categoryId: isCategorizable || isInsurancePayment ? categoryId : null,
      description: description.trim() || OPERATION_TYPE_LABELS[operationType!] || 'Movimentação',
      links: {
        investmentId: tempInvestmentId,
        loanId: tempLoanId,
        transferGroupId: editingTransaction?.links?.transferGroupId || null,
        parcelaId: tempParcelaId,
        vehicleTransactionId: isInsurancePayment ? `${tempSeguroId}_${tempSeguroParcelaId}` : null, 
      } as TransactionLinks,
      conciliated: false,
      attachments: [],
      meta: {
        createdBy: 'user',
        source: 'manual',
        createdAt: editingTransaction?.meta.createdAt || new Date().toISOString(),
        updatedAt: isEditing ? new Date().toISOString() : undefined,
        vehicleOperation: isVehicle ? tempVehicleOperation || undefined : undefined,
        tipoVeiculo: isVehicle ? tempTipoVeiculo : undefined,
        numeroContrato: isLoanLiberation ? tempNumeroContrato : undefined,
      }
    };
    
    let transferGroup;
    if (isTransfer && destinationAccountId) {
      transferGroup = {
        id: editingTransaction?.links?.transferGroupId || generateTransferGroupId(),
        fromAccountId: accountId,
        toAccountId: destinationAccountId,
        amount: parsedAmount,
        date,
        description: baseTx.description,
      };
    }
    
    onSubmit(baseTx, transferGroup);
    setIsSubmitting(false);
    onOpenChange(false);
  };
  
  const accountOptions = accounts.map(a => ({
      value: a.id,
      label: `${ACCOUNT_TYPE_LABELS[a.accountType]} - ${a.name}`,
      accountType: a.accountType,
      name: a.name,
  }));
  
  const operationOptions = availableOperations.map(op => {
      const config = OPERATION_CONFIG[op];
      return {
          value: op,
          label: config.label,
          icon: config.icon,
          color: config.colorClass,
      };
  });
  
  const destinationAccountOptions = accounts.filter(a => a.id !== accountId).map(a => ({
      value: a.id,
      label: `${ACCOUNT_TYPE_LABELS[a.accountType]} - ${a.name}`,
      accountType: a.accountType,
      name: a.name,
  }));
  
  const investmentOptions = investments.map(i => ({
      value: i.id,
      label: i.name,
      icon: PiggyBank,
      color: 'text-purple-500',
  }));
  
  const loanOptions = activeLoans.map(l => ({
      value: l.id,
      label: l.institution,
      icon: Building2,
      color: 'text-orange-500',
  }));
  
  const installmentOptions = availableInstallments.map(p => ({
      value: String(p.numero),
      label: `P${p.numero} - ${formatCurrency(p.valor)} (${parseDateLocal(p.vencimento).toLocaleDateString("pt-BR")})`,
      icon: Calendar,
      color: 'text-orange-500',
  }));
  
  const seguroOptions = availableSeguros.map(s => ({
      value: String(s.id),
      label: `${s.numeroApolice} (${s.seguradora})`,
      icon: Shield,
      color: 'text-blue-500',
  }));
  
  const seguroParcelaOptions = availableSeguroParcelas.map(p => ({
      value: String(p.numero),
      label: `P${p.numero} - ${formatCurrency(p.valor)} (${parseDateLocal(p.vencimento).toLocaleDateString("pt-BR")})`,
      icon: Calendar,
      color: 'text-blue-500',
  }));
  
  const categoryOptions = availableCategories.map(c => ({
      value: c.id,
      label: c.label,
      icon: Tags,
      nature: c.nature,
      iconComponent: c.icon,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border overflow-hidden flex flex-col p-0 shadow-lg animate-fade-in">
        
        {/* CABEÇALHO DINÂMICO */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              getOperationColor(operationType, 'iconBg')
            )}>
              <HeaderIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {isEditing ? "Editar Transação" : "Nova Movimentação"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {isEditing ? "Atualize os detalhes da transação" : "Registre uma nova transação financeira"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          
          {/* GRID DE DETALHES ESSENCIAIS (2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Conta */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Conta *
              </Label>
              <Select 
                value={accountId} 
                onValueChange={(v) => {
                    setAccountId(v);
                    const newAccount = accounts.find(a => a.id === v);
                    const newOps = getAvailableOperationTypes(newAccount?.accountType || 'corrente');
                    setOperationType(newOps[0] || null);
                }}
                disabled={isEditing}
              >
                <SelectTrigger className={cn("h-12 bg-background border-2 hover:border-primary/50 transition-colors rounded-xl", validationErrors.account && "border-destructive")}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      getAccountColor(selectedAccount?.accountType, 'bg')
                    )}>
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left truncate">
                      <div className="font-medium text-sm truncate">{selectedAccount?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[selectedAccount?.accountType || 'corrente']}
                      </div>
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                    {accountOptions.map(a => (
                        <SelectItem key={a.value} value={a.value}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    getAccountColor(a.accountType, 'bg')
                                )}>
                                    <Wallet className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium">{a.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {ACCOUNT_TYPE_LABELS[a.accountType]}
                                    </div>
                                </div>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Tipo Operação */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Tags className="w-3 h-3" /> Operação *
              </Label>
              <Select 
                value={operationType || ''} 
                onValueChange={(v) => {
                    setOperationType(v as OperationType);
                    setCategoryId(null); 
                    setTempInvestmentId(null);
                    setTempLoanId(null);
                    setTempParcelaId(null);
                    setDestinationAccountId(null);
                    setTempVehicleOperation(null);
                    setTempSeguroId(null); 
                    setTempSeguroParcelaId(null); 
                }}
                disabled={isEditing}
              >
                <SelectTrigger className={cn("h-12 bg-background border-2 hover:border-primary/50 transition-colors rounded-xl", validationErrors.operation && "border-destructive")}>
                    <div className="flex items-center gap-3">
                        <HeaderIcon className={cn("w-5 h-5", getOperationColor(operationType, 'text'))} />
                        <span className="font-medium text-sm">{operationType ? OPERATION_TYPE_LABELS[operationType] : 'Selecione...'}</span>
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {operationOptions.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                            <span className={cn("flex items-center gap-2 text-sm", op.color)}>
                                <op.icon className="w-4 h-4" />
                                {op.label}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 3. Data */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data *
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 text-base border-2 rounded-xl"
              />
            </div>

            {/* 4. Valor com botões rápidos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$) *</Label>
                <span className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(currentBalance)}
                </span>
              </div>
              <div className="relative group">
                <DollarSign className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors", validationErrors.amount && "text-destructive")} />
                <Input
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className={cn("h-12 pl-10 text-lg font-semibold border-2 rounded-xl hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20", validationErrors.amount && "border-destructive")}
                  placeholder="0,00"
                  disabled={isAmountAutoFilled}
                />
                {!isAmountAutoFilled && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                      {[100, 500, 1000].map(value => (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs rounded-lg"
                          onClick={() => setAmount(formatToBR(parseFromBR(amount) + value))}
                        >
                          +{value}
                        </Button>
                      ))}
                    </div>
                )}
              </div>
            </div>
          </div>
          
          {/* SISTEMA DE ABAS ELEGANTE */}
          <div className="space-y-4">
            <div className="flex gap-1 p-1 bg-muted/30 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('simples')}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-xl font-medium transition-all",
                  activeTab === 'simples'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Tags className="w-4 h-4" />
                  Classificação Simples
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('vinculo')}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-xl font-medium transition-all",
                  activeTab === 'vinculo'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  !isVinculoRequired && "opacity-50 cursor-not-allowed"
                )}
                disabled={!isVinculoRequired}
              >
                <div className="flex items-center justify-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  Vínculo / Contraparte
                </div>
              </button>
            </div>

            {/* CONTEÚDO ABA "SIMPLES" */}
            {activeTab === 'simples' && (
              <div className="space-y-5 pt-2">
                {/* Categoria com search */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Categoria {isCategorizable || isInsurancePayment ? '*' : ''}
                  </Label>
                  <Select 
                    value={categoryId || ''} 
                    onValueChange={(v) => {
                        setCategoryId(v);
                        if (v !== seguroCategory?.id) {
                            setTempSeguroId(null);
                            setTempSeguroParcelaId(null);
                        }
                    }}
                    disabled={isCategoryDisabled}
                  >
                    <SelectTrigger className={cn("h-12 rounded-xl border-2", validationErrors.category && "border-destructive")}>
                      {categoryId ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {categoryOptions.find(c => c.value === categoryId)?.iconComponent || <Tags className="w-4 h-4" />}
                          </div>
                          <span>{categoryOptions.find(c => c.value === categoryId)?.label}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Selecione uma categoria</span>
                      )}
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="p-2 border-b border-border sticky top-0 bg-card z-10">
                        <Input 
                            placeholder="Buscar categoria..." 
                            className="h-9" 
                            value={searchCategory}
                            onChange={(e) => setSearchCategory(e.target.value)}
                        />
                      </div>
                      {filteredCategories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              {category.iconComponent || <Tags className="w-4 h-4" />}
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{category.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {category.nature === 'receita' ? 'Receita' : 'Despesa'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.category && <p className="text-xs text-destructive mt-1">Categoria é obrigatória.</p>}
                </div>

                {/* Descrição com contador */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">
                      Descrição
                    </Label>
                    <span className={cn(
                      "text-xs",
                      description.length > 140 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {description.length}/150
                    </span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                    className="w-full min-h-[80px] p-3 border-2 border-input rounded-xl resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Descreva esta transação..."
                    maxLength={150}
                  />
                </div>
              </div>
            )}

            {/* CONTEÚDO ABA "VINCULADO" */}
            {activeTab === 'vinculo' && (
              <div className="space-y-5 pt-2">
                
                {/* Transferência */}
                {isTransfer && (
                  <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('transferencia', 'bg'))}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('transferencia', 'iconBg'))}>
                        <ArrowLeftRight className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">Transferência entre contas</h4>
                        <p className="text-sm text-muted-foreground">Envie dinheiro para outra conta</p>
                      </div>
                    </div>
                    <Select 
                        value={destinationAccountId || ''} 
                        onValueChange={setDestinationAccountId}
                    >
                      <SelectTrigger className={cn("h-12 rounded-xl border-2", validationErrors.transfer && "border-destructive")}>
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5 text-muted-foreground" />
                          <span>{destinationAccountId ? destinationAccountOptions.find(a => a.value === destinationAccountId)?.name : 'Selecione a conta destino'}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {destinationAccountOptions.map(a => (
                            <SelectItem key={a.value} value={a.value}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                        getAccountColor(a.accountType, 'bg')
                                    )}>
                                        <Wallet className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium">{a.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {ACCOUNT_TYPE_LABELS[a.accountType]}
                                        </div>
                                    </div>
                                </div>
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.transfer && <p className="text-xs text-destructive mt-1">Conta destino é obrigatória.</p>}
                  </div>
                )}

                {/* Pagamento Empréstimo */}
                {isLoanPayment && (
                  <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('pagamento_emprestimo', 'bg'))}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('pagamento_emprestimo', 'iconBg'))}>
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">Pagamento de Empréstimo</h4>
                        <p className="text-sm text-muted-foreground">Quitar parcela do contrato</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select 
                        value={tempLoanId || ''} 
                        onValueChange={(v) => { setTempLoanId(v); setTempParcelaId(null); }}
                      >
                        <SelectTrigger className={cn("h-11 rounded-xl border-2", validationErrors.loanPayment && !tempLoanId && "border-destructive")}>
                          {tempLoanId ? activeLoans.find(l => l.id === tempLoanId)?.institution : 'Contrato *'}
                        </SelectTrigger>
                        <SelectContent>
                            {loanOptions.map(l => (
                                <SelectItem key={l.value} value={l.value}>
                                    {l.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={tempParcelaId || ''} 
                        onValueChange={setTempParcelaId} 
                        disabled={!tempLoanId}
                      >
                        <SelectTrigger className={cn("h-11 rounded-xl border-2", validationErrors.loanPayment && tempLoanId && !tempParcelaId && "border-destructive")}>
                          {tempParcelaId ? `P${tempParcelaId}` : 'Parcela *'}
                        </SelectTrigger>
                        <SelectContent>
                            {installmentOptions.map(p => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {validationErrors.loanPayment && <p className="text-xs text-destructive mt-1">Contrato e Parcela são obrigatórios.</p>}
                  </div>
                )}
                
                {/* Pagamento Seguro */}
                {isInsurancePayment && (
                  <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('veiculo', 'bg'))}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('veiculo', 'iconBg'))}>
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">Pagamento de Seguro</h4>
                        <p className="text-sm text-muted-foreground">Quitar parcela do seguro</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select 
                        value={tempSeguroId || ''} 
                        onValueChange={(v) => { setTempSeguroId(v); setTempSeguroParcelaId(null); }}
                      >
                        <SelectTrigger className={cn("h-11 rounded-xl border-2", validationErrors.insurancePayment && !tempSeguroId && "border-destructive")}>
                          {tempSeguroId ? availableSeguros.find(s => String(s.id) === tempSeguroId)?.numeroApolice : 'Seguro *'}
                        </SelectTrigger>
                        <SelectContent>
                            {seguroOptions.map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={tempSeguroParcelaId || ''} 
                        onValueChange={setTempSeguroParcelaId} 
                        disabled={!tempSeguroId}
                      >
                        <SelectTrigger className={cn("h-11 rounded-xl border-2", validationErrors.insurancePayment && tempSeguroId && !tempSeguroParcelaId && "border-destructive")}>
                          {tempSeguroParcelaId ? `P${tempSeguroParcelaId}` : 'Parcela *'}
                        </SelectTrigger>
                        <SelectContent>
                            {seguroParcelaOptions.map(p => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {validationErrors.insurancePayment && <p className="text-xs text-destructive mt-1">Seguro e Parcela são obrigatórios.</p>}
                  </div>
                )}
                
                {/* Fluxo de Investimento */}
                {isInvestmentFlow && (
                    <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('aplicacao', 'bg'))}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('aplicacao', 'iconBg'))}>
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground">{operationType === 'aplicacao' ? 'Aplicação' : 'Resgate'}</h4>
                                <p className="text-sm text-muted-foreground">Movimentação para conta de investimento</p>
                            </div>
                        </div>
                        <Select 
                            value={tempInvestmentId || ''} 
                            onValueChange={setTempInvestmentId}
                        >
                            <SelectTrigger className={cn("h-12 rounded-xl border-2", validationErrors.investment && "border-destructive")}>
                                <div className="flex items-center gap-3">
                                    <PiggyBank className="w-5 h-5 text-muted-foreground" />
                                    <span>{tempInvestmentId ? investmentOptions.find(i => i.value === tempInvestmentId)?.label : 'Selecione o investimento *'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {investmentOptions.map(i => (
                                    <SelectItem key={i.value} value={i.value}>
                                        {i.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {validationErrors.investment && <p className="text-xs text-destructive mt-1">Conta de investimento é obrigatória.</p>}
                    </div>
                )}
                
                {/* Liberação Empréstimo */}
                {isLoanLiberation && (
                    <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('liberacao_emprestimo', 'bg'))}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('liberacao_emprestimo', 'iconBg'))}>
                                <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground">Liberação de Empréstimo</h4>
                                <p className="text-sm text-muted-foreground">Registro de entrada de capital de empréstimo</p>
                            </div>
                        </div>
                        <Input
                            placeholder="Número do Contrato *"
                            value={tempNumeroContrato}
                            onChange={(e) => setTempNumeroContrato(e.target.value)}
                            className={cn("h-12 text-base border-2 rounded-xl", validationErrors.loanLiberation && "border-destructive")}
                        />
                        {validationErrors.loanLiberation && <p className="text-xs text-destructive mt-1">Número do contrato é obrigatório.</p>}
                    </div>
                )}
                
                {/* Veículo */}
                {isVehicle && (
                    <div className={cn("p-4 border border-border rounded-xl shadow-sm", getOperationColor('veiculo', 'bg'))}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", getOperationColor('veiculo', 'iconBg'))}>
                                <Car className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground">Operação de Veículo</h4>
                                <p className="text-sm text-muted-foreground">Compra ou Venda de Ativo</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Select 
                                value={tempVehicleOperation || ''} 
                                onValueChange={(v) => setTempVehicleOperation(v as 'compra' | 'venda')}
                            >
                                <SelectTrigger className={cn("h-11 rounded-xl border-2", validationErrors.vehicle && !tempVehicleOperation && "border-destructive")}>
                                    {tempVehicleOperation ? (tempVehicleOperation === 'compra' ? 'Compra (Saída)' : 'Venda (Entrada)') : 'Operação *'}
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="compra">Compra (Saída)</SelectItem>
                                    <SelectItem value="venda">Venda (Entrada)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select 
                                value={tempTipoVeiculo} 
                                onValueChange={(v) => setTempTipoVeiculo(v as 'carro' | 'moto' | 'caminhao')}
                            >
                                <SelectTrigger className="h-11 rounded-xl border-2">
                                    {tempTipoVeiculo}
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="carro">Carro</SelectItem>
                                    <SelectItem value="moto">Moto</SelectItem>
                                    <SelectItem value="caminhao">Caminhão</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {validationErrors.vehicle && <p className="text-xs text-destructive mt-1">Operação é obrigatória.</p>}
                    </div>
                )}
                
                {/* Mensagem se não houver vínculo selecionado */}
                {!isTransfer && !isInvestmentFlow && !isFinancingFlow && !isVehicle && !isInsurancePayment && (
                    <div className="text-center p-8 text-muted-foreground">
                        <Info className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-sm">Esta operação não requer vínculo. Use a aba "Classificação Simples".</p>
                    </div>
                )}
              </div>
            )}
            
            {/* Preview da Transação */}
            {isValid && operationType && (
              <div className="mt-4 p-4 rounded-xl border shadow-sm"
                style={{ 
                    backgroundColor: getOperationColor(operationType, 'bg'),
                    borderColor: getOperationColor(operationType, 'border'),
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">Resumo da Transação</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(date).toLocaleDateString('pt-BR')} • {OPERATION_TYPE_LABELS[operationType]}
                    </div>
                  </div>
                  <div className={cn(
                    "text-xl font-bold",
                    (operationType === 'receita' || operationType === 'liberacao_emprestimo' || operationType === 'rendimento' || (operationType === 'veiculo' && tempVehicleOperation === 'venda')) ? "text-success" : "text-destructive"
                  )}>
                    {(operationType === 'receita' || operationType === 'liberacao_emprestimo' || operationType === 'rendimento' || (operationType === 'veiculo' && tempVehicleOperation === 'venda')) ? '+' : '-'} {formatCurrency(parseFromBR(amount))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* BOTÕES COM DESIGN PREMIUM */}
        <DialogFooter className="p-6 pt-6 border-t border-border/50 shrink-0">
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 rounded-xl border-2 hover:bg-muted/50"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              className={cn(
                "flex-1 h-12 rounded-xl font-semibold transition-all",
                "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary",
                "shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
                !isValid || isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              )}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {isEditing ? "Salvar Alterações" : "Registrar Transação"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}