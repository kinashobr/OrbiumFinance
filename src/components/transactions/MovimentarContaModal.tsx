import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Wallet, PiggyBank, TrendingUp, Shield, Target, Bitcoin, CreditCard, ArrowLeftRight, DollarSign, Car } from "lucide-react";
import { ContaCorrente, AccountType, ACCOUNT_TYPE_LABELS, generateAccountId, formatCurrency, OperationType, generateTransferGroupId } from "@/types/finance";
import { toast } from "sonner";

// Interface simplificada para Empréstimo
interface LoanInfo {
  id: string;
  institution: string;
  numeroContrato?: string;
  parcelas: {
    numero: number;
    vencimento: string;
    valor: number;
    pago: boolean;
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

interface MovimentarContaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ContaCorrente[];
  categories: { id: string; label: string; nature: 'receita' | 'despesa_fixa' | 'despesa_variavel' }[];
  investments: InvestmentInfo[];
  loans: LoanInfo[];
  selectedAccountId?: string;
  onSubmit: (transaction: Omit<any, 'id' | 'flow' | 'domain' | 'conciliated' | 'attachments' | 'meta'> & { links: any, meta: any }, transferGroup?: { id: string; fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string }) => void;
  editingTransaction?: any;
}

const getAvailableOperations = (accountType: AccountType): OperationType[] => {
  switch (accountType) {
    case 'corrente':
      return ['receita', 'despesa', 'transferencia', 'aplicacao', 'resgate', 'pagamento_emprestimo', 'liberacao_emprestimo', 'veiculo', 'rendimento'];
    case 'cartao_credito':
      return ['despesa', 'transferencia']; // Despesa (compra) e Transferência (pagamento de fatura)
    case 'renda_fixa':
    case 'poupanca':
    case 'reserva':
    case 'objetivo':
    case 'cripto':
      return ['rendimento', 'aplicacao', 'resgate'];
    default:
      return ['despesa'];
  }
};

const getCategoryOptions = (operationType: OperationType, categories: MovimentarContaModalProps['categories']) => {
  if (operationType === 'transferencia' || operationType === 'aplicacao' || operationType === 'resgate' || operationType === 'pagamento_emprestimo' || operationType === 'liberacao_emprestimo' || operationType === 'veiculo' || operationType === 'initial_balance') {
    return [];
  }
  
  const isIncome = operationType === 'receita' || operationType === 'rendimento';
  
  return categories.filter(c => 
    (isIncome && c.nature === 'receita') || 
    (!isIncome && c.nature !== 'receita')
  );
};

const getOperationIcon = (op: OperationType) => {
  switch (op) {
    case 'receita': return <TrendingUp className="w-4 h-4 text-success" />;
    case 'despesa': return <TrendingDown className="w-4 h-4 text-destructive" />;
    case 'transferencia': return <ArrowLeftRight className="w-4 h-4 text-primary" />;
    case 'aplicacao': return <PiggyBank className="w-4 h-4 text-purple-500" />;
    case 'resgate': return <PiggyBank className="w-4 h-4 text-amber-500" />;
    case 'pagamento_emprestimo': return <CreditCard className="w-4 h-4 text-orange-500" />;
    case 'liberacao_emprestimo': return <DollarSign className="w-4 h-4 text-emerald-500" />;
    case 'veiculo': return <Car className="w-4 h-4 text-blue-500" />;
    case 'rendimento': return <TrendingUp className="w-4 h-4 text-teal-500" />;
    case 'initial_balance': return <Wallet className="w-4 h-4 text-muted-foreground" />;
    default: return <DollarSign className="w-4 h-4 text-muted-foreground" />;
  }
};

const getOperationFlow = (op: OperationType, accountType: AccountType): 'in' | 'out' => {
  if (accountType === 'cartao_credito') {
    return op === 'despesa' ? 'out' : 'in'; // Compra é saída, Pagamento de fatura (transferencia) é entrada
  }
  
  switch (op) {
    case 'receita':
    case 'resgate':
    case 'liberacao_emprestimo':
    case 'rendimento':
    case 'initial_balance':
      return 'in';
    case 'despesa':
    case 'aplicacao':
    case 'pagamento_emprestimo':
    case 'veiculo':
    case 'transferencia':
      return 'out';
    default:
      return 'out';
  }
};

const getOperationDomain = (op: OperationType) => {
  switch (op) {
    case 'aplicacao':
    case 'resgate':
    case 'rendimento':
      return 'investment';
    case 'pagamento_emprestimo':
    case 'liberacao_emprestimo':
      return 'financing';
    case 'veiculo':
      return 'asset';
    default:
      return 'operational';
  }
};

export function MovimentarContaModal({
  open,
  onOpenChange,
  accounts,
  categories,
  investments,
  loans,
  selectedAccountId,
  onSubmit,
  editingTransaction,
}: MovimentarContaModalProps) {
  const [accountId, setAccountId] = useState(selectedAccountId || accounts[0]?.id || "");
  const [operationType, setOperationType] = useState<OperationType>('despesa');
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  
  // Transfer/Link specific states
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [tempInvestmentId, setTempInvestmentId] = useState<string | null>(null);
  const [tempLoanId, setTempLoanId] = useState<string | null>(null);
  const [tempVehicleOperation, setTempVehicleOperation] = useState<'compra' | 'venda' | null>(null);
  const [tempVehicleType, setTempVehicleType] = useState<'carro' | 'moto' | 'caminhao' | null>(null);
  const [tempLoanContract, setTempLoanContract] = useState<string | null>(null);
  
  const isEditing = !!editingTransaction;

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        // Load existing transaction data
        setAccountId(editingTransaction.accountId);
        setOperationType(editingTransaction.operationType);
        setAmount(editingTransaction.amount.toFixed(2).replace('.', ','));
        setDate(editingTransaction.date);
        setDescription(editingTransaction.description);
        setCategoryId(editingTransaction.categoryId);
        
        // Load links
        setDestinationAccountId(editingTransaction.links?.transferGroupId ? accounts.find(a => a.id !== editingTransaction.accountId && a.links?.transferGroupId === editingTransaction.links.transferGroupId)?.id || null : null);
        setTempInvestmentId(editingTransaction.links?.investmentId || null);
        setTempLoanId(editingTransaction.links?.loanId || null);
        setTempVehicleOperation(editingTransaction.meta?.vehicleOperation || null);
        setTempVehicleType(editingTransaction.meta?.tipoVeiculo || null);
        setTempLoanContract(editingTransaction.meta?.numeroContrato || null);
        
      } else {
        // Reset for new transaction
        setAccountId(selectedAccountId || accounts[0]?.id || "");
        setOperationType('despesa');
        setAmount("");
        setDate(new Date().toISOString().split('T')[0]);
        setDescription("");
        setCategoryId(null);
        setDestinationAccountId(null);
        setTempInvestmentId(null);
        setTempLoanId(null);
        setTempVehicleOperation(null);
        setTempVehicleType(null);
        setTempLoanContract(null);
      }
    }
  }, [open, selectedAccountId, accounts, editingTransaction]);

  const selectedAccount = accounts.find(a => a.id === accountId);
  const availableOperations = selectedAccount ? getAvailableOperations(selectedAccount.accountType) : [];
  const categoryOptions = getCategoryOptions(operationType, categories);
  
  const isTransfer = operationType === 'transferencia';
  const isInvestmentFlow = operationType === 'aplicacao' || operationType === 'resgate';
  const isLoanPayment = operationType === 'pagamento_emprestimo';
  const isLoanLiberation = operationType === 'liberacao_emprestimo';
  const isVehicleOperation = operationType === 'veiculo';
  const isCategorizable = !isTransfer && !isInvestmentFlow && !isLoanPayment && !isLoanLiberation && !isVehicleOperation && operationType !== 'initial_balance';

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^\d,]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) return;
    setAmount(cleaned);
  };

  const parseAmount = (value: string): number => {
    const parsed = parseFloat(value.replace('.', '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmount(amount);

    if (!accountId || parsedAmount <= 0 || !date || !description.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    
    if (isCategorizable && !categoryId) {
        toast.error("Selecione uma categoria.");
        return;
    }
    
    if (isTransfer && !destinationAccountId) {
        toast.error("Selecione a conta de destino para a transferência.");
        return;
    }
    
    if (isInvestmentFlow && !tempInvestmentId) {
        toast.error("Selecione a conta de investimento.");
        return;
    }
    
    if (isLoanPayment && !tempLoanId) {
        toast.error("Selecione o contrato de empréstimo.");
        return;
    }
    
    if (isLoanLiberation && !tempLoanContract) {
        toast.error("Informe o número do contrato de empréstimo.");
        return;
    }
    
    if (isVehicleOperation && !tempVehicleOperation) {
        toast.error("Selecione o tipo de operação de veículo (Compra/Venda).");
        return;
    }
    
    if (isVehicleOperation && tempVehicleOperation === 'compra' && !tempVehicleType) {
        toast.error("Selecione o tipo de veículo.");
        return;
    }

    const flow = getOperationFlow(operationType, selectedAccount!.accountType);
    const domain = getOperationDomain(operationType);
    
    let transferGroup: { id: string; fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string } | undefined;
    let links: any = {
        investmentId: tempInvestmentId,
        loanId: tempLoanId,
        transferGroupId: editingTransaction?.links?.transferGroupId || null,
        parcelaId: null,
        vehicleTransactionId: null,
    };
    let meta: any = {
        createdBy: 'user',
        source: 'manual',
        createdAt: editingTransaction?.meta?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vehicleOperation: tempVehicleOperation,
        tipoVeiculo: tempVehicleType,
        numeroContrato: tempLoanContract,
    };
    
    if (isTransfer && destinationAccountId) {
        const fromAccountId = accountId;
        const toAccountId = destinationAccountId;
        
        transferGroup = {
            id: editingTransaction?.links?.transferGroupId || generateTransferGroupId(),
            fromAccountId,
            toAccountId,
            amount: parsedAmount,
            date,
            description: description.trim(),
        };
        links.transferGroupId = transferGroup.id;
    }
    
    if (isLoanPayment && tempLoanId) {
        const loan = loans.find(l => l.id === tempLoanId);
        if (loan) {
            // Tenta encontrar a próxima parcela pendente
            const nextParcela = loan.parcelas.find(p => !p.pago);
            if (nextParcela) {
                links.parcelaId = nextParcela.numero.toString();
            }
        }
    }
    
    // Se for pagamento de seguro (veículo), o link é feito via vehicleTransactionId
    if (isLoanPayment && tempLoanId?.startsWith('insurance_')) {
        // Lógica de seguro removida daqui, deve ser tratada no BillsTracker ou na importação
    }

    const transactionData = {
      id: editingTransaction?.id,
      date,
      accountId,
      operationType,
      amount: parsedAmount,
      categoryId: isCategorizable ? categoryId : null,
      description: description.trim(),
      links,
      meta,
    };

    onSubmit(transactionData, transferGroup);
    onOpenChange(false);
    toast.success(isEditing ? "Transação atualizada!" : "Transação registrada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getOperationIcon(operationType)}
            {isEditing ? "Editar Transação" : "Nova Movimentação"}
          </DialogTitle>
          <DialogDescription>
              {selectedAccount?.accountType === 'corrente'
                ? "Registre receitas, despesas, aplicações e operações de empréstimo."
                : selectedAccount?.accountType === 'cartao_credito'
                ? "Registre compras e pagamentos de fatura."
                : "Registre aplicações, resgates e rendimentos."
              }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conta e Tipo de Operação */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountId">Conta *</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={isEditing}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({ACCOUNT_TYPE_LABELS[a.accountType]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="operationType">Tipo de Operação *</Label>
              <Select 
                value={operationType} 
                onValueChange={(v) => {
                    setOperationType(v as OperationType);
                    setCategoryId(null); // Reset category on operation change
                }}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOperations.map(op => (
                    <SelectItem key={op} value={op}>
                      <span className="flex items-center gap-2">
                        {getOperationIcon(op)}
                        {op.charAt(0).toUpperCase() + op.slice(1).replace('_', ' ')}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          
          {/* Vínculos (Transferência, Investimento, Empréstimo, Veículo) */}
          {(isTransfer || isInvestmentFlow || isLoanPayment || isLoanLiberation || isVehicleOperation) && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
              <Label className="font-semibold text-primary">Vínculo da Operação</Label>
              
              {/* Transferência */}
              {isTransfer && (
                <Select 
                  value={destinationAccountId || ''} 
                  onValueChange={setDestinationAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Conta de Destino *" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.id !== accountId).map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({ACCOUNT_TYPE_LABELS[a.accountType]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Aplicação/Resgate */}
              {isInvestmentFlow && (
                <Select 
                  value={tempInvestmentId || ''} 
                  onValueChange={setTempInvestmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Conta de Investimento *" />
                  </SelectTrigger>
                  <SelectContent>
                    {investments.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Pagamento Empréstimo */}
              {isLoanPayment && (
                <Select 
                  value={tempLoanId || ''} 
                  onValueChange={setTempLoanId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Contrato de Empréstimo *" />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.institution} ({l.numeroContrato})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Liberação Empréstimo */}
              {isLoanLiberation && (
                <Input
                  placeholder="Número do Contrato *"
                  value={tempLoanContract || ''}
                  onChange={(e) => setTempLoanContract(e.target.value)}
                />
              )}
              
              {/* Operação Veículo */}
              {isVehicleOperation && (
                <div className="space-y-2">
                  <Select 
                    value={tempVehicleOperation || ''} 
                    onValueChange={(v) => setTempVehicleOperation(v as 'compra' | 'venda')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de Operação *" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra (Saída)</SelectItem>
                      <SelectItem value="venda">Venda (Entrada)</SelectItem>
                    </SelectContent>
                  </Select>
                  {tempVehicleOperation === 'compra' && (
                    <Select 
                      value={tempVehicleType || ''} 
                      onValueChange={(v) => setTempVehicleType(v as 'carro' | 'moto' | 'caminhao')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de Veículo *" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="carro">Carro</SelectItem>
                        <SelectItem value="moto">Moto</SelectItem>
                        <SelectItem value="caminhao">Caminhão</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categoria (Apenas para Receita/Despesa/Rendimento) */}
          {isCategorizable && (
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria *</Label>
              <Select 
                value={categoryId || ''} 
                onValueChange={setCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} ({c.nature.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              placeholder="Ex: Aluguel de Janeiro"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing ? "Salvar Alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}