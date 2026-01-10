"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Wallet, TrendingUp, CreditCard, ArrowLeftRight, Car, DollarSign, Plus, Minus, RefreshCw, Coins, TrendingDown, Tags, Calendar, FileText, LinkIcon, Check, X } from "lucide-react";
import { ContaCorrente, Categoria, AccountType, ACCOUNT_TYPE_LABELS, generateTransactionId, OperationType, TransacaoCompleta, TransactionLinks, generateTransferGroupId, getFlowTypeFromOperation, getDomainFromOperation, InvestmentInfo, SeguroVeiculo, Veiculo, OPERATION_TYPE_LABELS } from "@/types/finance";
import { toast } from "sonner";
import { cn, parseDateLocal } from "@/lib/utils";

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

const OPERATION_OPTIONS: { value: OperationType; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { value: 'receita', label: 'Receita', icon: Plus, color: 'text-success', bgColor: 'bg-success/10' },
  { value: 'despesa', label: 'Despesa', icon: Minus, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  { value: 'transferencia', label: 'Transferência', icon: ArrowLeftRight, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'aplicacao', label: 'Aplicação', icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'resgate', label: 'Resgate', icon: TrendingDown, color: 'text-warning', bgColor: 'bg-warning/10' },
  { value: 'pagamento_emprestimo', label: 'Pag. Empréstimo', icon: CreditCard, color: 'text-warning', bgColor: 'bg-warning/10' },
  { value: 'liberacao_emprestimo', label: 'Liberação', icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'veiculo', label: 'Veículo', icon: Car, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'rendimento', label: 'Rendimento', icon: Coins, color: 'text-primary', bgColor: 'bg-primary/10' },
];

const getAvailableOperationTypes = (accountType: AccountType): OperationType[] => {
  switch (accountType) {
    case 'corrente':
      return ['receita', 'despesa', 'transferencia', 'aplicacao', 'resgate', 'pagamento_emprestimo', 'liberacao_emprestimo', 'veiculo', 'rendimento'];
    case 'cartao_credito':
      return ['despesa', 'transferencia'];
    case 'renda_fixa':
    case 'poupanca':
    case 'reserva':
    case 'objetivo':
    case 'cripto':
      return ['aplicacao', 'resgate', 'rendimento'];
    default:
      return ['receita', 'despesa'];
  }
};

const formatToBR = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseFromBR = (value: string): number => {
    const cleaned = value.replace(/[^\d,]/g, '');
    const parsed = parseFloat(cleaned.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
};

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
  const [tempParcelaId, setTempParcelaId] = useState<string | null>(null);
  const [tempSeguroId, setTempSeguroId] = useState<string | null>(null);
  const [tempSeguroParcelaId, setTempSeguroParcelaId] = useState<string | null>(null);

  const isEditing = !!editingTransaction;
  const selectedAccount = accounts.find(a => a.id === accountId);
  const availableOperations = selectedAccount ? getAvailableOperationTypes(selectedAccount.accountType) : [];
  
  const isTransfer = operationType === 'transferencia';
  const isInvestmentFlow = operationType === 'aplicacao' || operationType === 'resgate';
  const isLoanPayment = operationType === 'pagamento_emprestimo';
  const isInsurancePayment = operationType === 'despesa' && categories.find(c => c.id === categoryId)?.label.toLowerCase() === 'seguro';
  
  const availableCategories = useMemo(() => {
    if (!operationType || isTransfer) return [];
    const isIncome = ['receita', 'rendimento', 'liberacao_emprestimo'].includes(operationType);
    return categories.filter(c => (isIncome && c.nature === 'receita') || (!isIncome && c.nature !== 'receita'));
  }, [operationType, categories, isTransfer]);

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        setAccountId(editingTransaction.accountId);
        setDate(editingTransaction.date);
        setAmount(formatToBR(editingTransaction.amount));
        setOperationType(editingTransaction.operationType);
        setCategoryId(editingTransaction.categoryId);
        setDescription(editingTransaction.description);
        setTempInvestmentId(editingTransaction.links?.investmentId || null);
        setTempLoanId(editingTransaction.links?.loanId || null);
        setTempParcelaId(editingTransaction.links?.parcelaId || null);
      } else {
        setAccountId(selectedAccountId || accounts[0]?.id || '');
        setDate(new Date().toISOString().split('T')[0]);
        setAmount("");
        setOperationType(availableOperations[0] || null);
        setCategoryId(null);
        setDescription("");
      }
    }
  }, [open, editingTransaction, selectedAccountId, accounts, availableOperations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFromBR(amount);
    if (!accountId || !date || parsedAmount <= 0 || !operationType) return;
    
    const baseTx: TransacaoCompleta = {
      id: editingTransaction?.id || generateTransactionId(),
      date,
      accountId,
      flow: getFlowTypeFromOperation(operationType, tempVehicleOperation || undefined),
      operationType,
      domain: getDomainFromOperation(operationType),
      amount: parsedAmount,
      categoryId,
      description: description.trim() || OPERATION_TYPE_LABELS[operationType],
      links: {
        investmentId: tempInvestmentId,
        loanId: tempLoanId,
        transferGroupId: editingTransaction?.links?.transferGroupId || null,
        parcelaId: tempParcelaId,
        vehicleTransactionId: null,
        vehicleId: null
      } as any,
      conciliated: false,
      attachments: [],
      meta: { createdBy: 'user', source: 'manual', createdAt: new Date().toISOString() }
    };
    
    onSubmit(baseTx);
    onOpenChange(false);
  };

  const selectedOpConfig = OPERATION_OPTIONS.find(op => op.value === operationType);
  const headerBg = selectedOpConfig?.bgColor || "bg-muted";
  const headerIconColor = selectedOpConfig?.color || "text-foreground";
  const HeaderIcon = selectedOpConfig?.icon || DollarSign;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,36rem)] p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl bg-background">
        <DialogHeader className={cn("px-8 pt-8 pb-6 shrink-0 transition-colors duration-500", headerBg)}>
          <div className="flex items-center gap-5">
            <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg bg-card", headerIconColor)}>
              <HeaderIcon className="w-8 h-8" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                {isEditing ? "Editar Registro" : "Nova Movimentação"}
              </DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
                {selectedAccount?.name} • Gestão de Fluxo
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Operação</Label>
              <Select value={operationType || ''} onValueChange={(v) => setOperationType(v as OperationType)}>
                <SelectTrigger className="h-12 border-2 rounded-2xl bg-card hover:border-primary/30 transition-all font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOperations.map(op => {
                    const opt = OPERATION_OPTIONS.find(o => o.value === op);
                    return opt && (
                      <SelectItem key={op} value={op} className="font-bold">
                        <span className={cn("flex items-center gap-2", opt.color)}>{opt.label}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))}
                className="h-12 border-2 rounded-2xl bg-card text-lg font-black"
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 border-2 rounded-2xl bg-card font-bold" />
            </div>

            {!isTransfer && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Categoria</Label>
                <Select value={categoryId || ''} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-12 border-2 rounded-2xl bg-card hover:border-primary/30 transition-all font-bold">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {availableCategories.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-bold">
                        {c.icon} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Descrição</Label>
            <div className="relative">
                <FileText className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-24 p-4 pl-12 border-2 rounded-3xl bg-card focus:border-primary/50 transition-all resize-none font-medium text-sm"
                    placeholder="O que aconteceu nesta transação?"
                />
            </div>
          </div>
        </form>

        <DialogFooter className="p-8 bg-muted/20 border-t flex gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full h-12 px-6 font-bold text-muted-foreground">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1 rounded-full h-12 bg-primary text-primary-foreground font-black text-sm gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Check className="w-5 h-5" />
            {isEditing ? "SALVAR ALTERAÇÕES" : "CONFIRMAR REGISTRO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}