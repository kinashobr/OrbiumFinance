import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, Clock, AlertTriangle, DollarSign, Building2, Shield, Repeat, Info, X } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillTracker, BillSourceType, formatCurrency, TransacaoCompleta, getDomainFromOperation, generateTransactionId } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditableCell } from "../EditableCell"; // Import EditableCell

interface BillsTrackerListProps {
  bills: BillTracker[];
  onUpdateBill: (id: string, updates: Partial<BillTracker>) => void;
  onDeleteBill: (id: string) => void;
  onAddBill: (bill: Omit<BillTracker, "id" | "isPaid">) => void;
  currentDate: Date;
}

const SOURCE_CONFIG: Record<BillSourceType, { icon: React.ElementType; color: string; label: string }> = {
  loan_installment: { icon: Building2, color: 'text-orange-500', label: 'Empréstimo' },
  insurance_installment: { icon: Shield, color: 'text-blue-500', label: 'Seguro' },
  fixed_expense: { icon: Repeat, color: 'text-purple-500', label: 'Fixa' },
  variable_expense: { icon: DollarSign, color: 'text-warning', label: 'Variável' }, // NEW
  ad_hoc: { icon: Info, color: 'text-primary', label: 'Avulsa' },
};

export function BillsTrackerList({
  bills,
  onUpdateBill,
  onDeleteBill,
  onAddBill,
  currentDate,
}: BillsTrackerListProps) {
  const { addTransacaoV2, categoriasV2, contasMovimento, markLoanParcelPaid, unmarkLoanParcelPaid, markSeguroParcelPaid, unmarkSeguroParcelPaid, setTransacoesV2 } = useFinance();
  
  const [newBillData, setNewBillData] = useState({
    description: '',
    amount: '',
    dueDate: format(currentDate, 'yyyy-MM-dd'),
  });
  
  // Removido showAdHocForm, pois será sempre visível

  const formatAmount = (value: string) => {
    const cleaned = value.replace(/[^\d,]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) return value;
    return cleaned;
  };

  const parseAmount = (value: string): number => {
    const parsed = parseFloat(value.replace('.', '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleAddAdHocBill = () => {
    const amount = parseAmount(newBillData.amount);
    if (!newBillData.description || amount <= 0 || !newBillData.dueDate) {
      toast.error("Preencha a descrição, valor e data de vencimento.");
      return;
    }

    onAddBill({
      description: newBillData.description,
      dueDate: newBillData.dueDate,
      expectedAmount: amount,
      sourceType: 'ad_hoc',
      suggestedAccountId: contasMovimento.find(c => c.accountType === 'conta_corrente')?.id,
      suggestedCategoryId: categoriasV2.find(c => c.nature === 'despesa_variavel')?.id,
    });

    setNewBillData({ description: '', amount: '', dueDate: format(currentDate, 'yyyy-MM-dd') });
    toast.success("Conta avulsa adicionada!");
  };
  
  const handleExcludeBill = (bill: BillTracker) => {
    if (bill.sourceType === 'loan_installment' || bill.sourceType === 'insurance_installment') {
        toast.error("Não é possível excluir parcelas de empréstimo ou seguro.");
        return;
    }
    
    if (bill.isPaid) {
        toast.error("Desmarque o pagamento antes de excluir.");
        return;
    }
    
    // Mark as excluded in the tracker state
    onUpdateBill(bill.id, { isExcluded: true });
    toast.info(`Conta "${bill.description}" excluída da lista deste mês.`);
  };
  
  const handleUpdateExpectedAmount = (bill: BillTracker, newAmount: number) => {
    if (bill.sourceType === 'loan_installment' || bill.sourceType === 'insurance_installment') {
        toast.error("Valor de parcelas fixas deve ser alterado no cadastro do Empréstimo/Seguro.");
        return;
    }
    
    onUpdateBill(bill.id, { expectedAmount: newAmount });
    toast.success("Valor atualizado!");
  };

  const handleMarkAsPaid = useCallback((bill: BillTracker, isChecked: boolean) => {
    if (!isChecked) {
      // Reverter pagamento
      if (bill.transactionId) {
        // 1. Reverter marcação de empréstimo/seguro (se aplicável)
        if (bill.sourceType === 'loan_installment' && bill.sourceRef) {
            const loanId = parseInt(bill.sourceRef);
            if (!isNaN(loanId)) {
                unmarkLoanParcelPaid(loanId);
            }
        } else if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
            const seguroId = parseInt(bill.sourceRef);
            if (!isNaN(seguroId)) {
                unmarkSeguroParcelPaid(seguroId, bill.parcelaNumber);
            }
        }
        
        // 2. Remover a transação do extrato
        setTransacoesV2(prev => prev.filter(t => t.id !== bill.transactionId));
        
        // 3. Atualizar BillTracker
        onUpdateBill(bill.id, { isPaid: false, paymentDate: undefined, transactionId: undefined });
        toast.warning("Pagamento estornado e transação excluída.");
      }
      return;
    }

    // Marcar como pago
    const suggestedAccount = contasMovimento.find(c => c.id === bill.suggestedAccountId);
    const suggestedCategory = categoriasV2.find(c => c.id === bill.suggestedCategoryId);
    
    if (!suggestedAccount) {
      toast.error("Conta de débito sugerida não encontrada. Configure uma conta corrente.");
      return;
    }
    if (!suggestedCategory && bill.sourceType !== 'loan_installment' && bill.sourceType !== 'insurance_installment') {
      toast.error("Categoria sugerida não encontrada.");
      return;
    }

    const transactionId = generateTransactionId();
    const paymentDate = format(currentDate, 'yyyy-MM-dd');
    
    let operationType: TransacaoCompleta['operationType'] = 'despesa';
    let loanIdLink: string | null = null;
    let parcelaIdLink: string | null = null;
    let vehicleTransactionIdLink: string | null = null;
    
    if (bill.sourceType === 'loan_installment' && bill.sourceRef && bill.parcelaNumber) {
      operationType = 'pagamento_emprestimo';
      loanIdLink = `loan_${bill.sourceRef}`;
      parcelaIdLink = bill.parcelaNumber.toString();
    } else if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
      operationType = 'despesa';
      vehicleTransactionIdLink = `${bill.sourceRef}_${bill.parcelaNumber}`;
    }

    const newTransaction: TransacaoCompleta = {
      id: transactionId,
      date: paymentDate,
      accountId: suggestedAccount.id,
      flow: 'out',
      operationType,
      domain: getDomainFromOperation(operationType),
      amount: bill.expectedAmount,
      categoryId: bill.suggestedCategoryId || null,
      description: bill.description,
      links: {
        investmentId: null,
        loanId: loanIdLink,
        transferGroupId: null,
        parcelaId: parcelaIdLink,
        vehicleTransactionId: vehicleTransactionIdLink,
      },
      conciliated: false,
      attachments: [],
      meta: {
        createdBy: 'system',
        source: 'bill_tracker',
        createdAt: format(currentDate, 'yyyy-MM-dd'),
      }
    };

    // 1. Adicionar Transação
    addTransacaoV2(newTransaction);
    
    // 2. Atualizar status de Empréstimo/Seguro (se aplicável)
    if (bill.sourceType === 'loan_installment' && bill.sourceRef && bill.parcelaNumber) {
        const loanId = parseInt(bill.sourceRef);
        if (!isNaN(loanId)) {
            markLoanParcelPaid(loanId, bill.expectedAmount, paymentDate, bill.parcelaNumber);
        }
    } else if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
        const seguroId = parseInt(bill.sourceRef);
        if (!isNaN(seguroId)) {
            markSeguroParcelPaid(seguroId, bill.parcelaNumber, transactionId);
        }
    }

    // 3. Atualizar BillTracker
    onUpdateBill(bill.id, { isPaid: true, paymentDate, transactionId });
    toast.success(`Conta "${bill.description}" paga e registrada!`);

  }, [addTransacaoV2, onUpdateBill, categoriasV2, contasMovimento, currentDate, markLoanParcelPaid, markSeguroParcelPaid, unmarkLoanParcelPaid, unmarkSeguroParcelPaid, setTransacoesV2]);

  const pendingBills = bills.filter(b => !b.isPaid);
  const paidBills = bills.filter(b => b.isPaid);
  
  const totalPending = pendingBills.reduce((acc, b) => acc + b.expectedAmount, 0);

  const formatDate = (dateStr: string) => {
    const date = parseDateLocal(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };
  
  const getCategoryLabel = (categoryId: string | undefined) => {
    if (!categoryId) return 'N/A';
    const cat = categoriasV2.find(c => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.label}` : 'N/A';
  };
  
  const getAccountName = (accountId: string | undefined) => {
    if (!accountId) return 'N/A';
    return contasMovimento.find(c => c.id === accountId)?.name || 'N/A';
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Adição Rápida (Ad-Hoc) - SEMPRE VISÍVEL E MINIMALISTA */}
      <div className="glass-card p-3 shrink-0">
        <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input
              value={newBillData.description}
              onChange={(e) => setNewBillData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Conta avulsa"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={newBillData.amount}
              onChange={(e) => setNewBillData(prev => ({ ...prev, amount: formatAmount(e.target.value) }))}
              placeholder="0,00"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vencimento</Label>
            <Input
              type="date"
              value={newBillData.dueDate}
              onChange={(e) => setNewBillData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="h-7 text-xs"
            />
          </div>
          <Button 
            onClick={handleAddAdHocBill} 
            className="h-7 w-full text-xs p-0"
            disabled={!newBillData.description || parseAmount(newBillData.amount) <= 0 || !newBillData.dueDate}
            title="Adicionar conta avulsa"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabela de Contas Pendentes */}
      <div className="glass-card p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Contas Pendentes ({pendingBills.length})</h3>
          <Badge variant="destructive" className="text-xs">
            Total: {formatCurrency(totalPending)}
          </Badge>
        </div>
        
        <div className="rounded-lg border border-border overflow-y-auto flex-1 min-h-[100px]">
          <Table className="min-w-[600px]">
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent h-8">
                <TableHead className="text-muted-foreground w-10 text-center p-1 text-xs">Pagar</TableHead>
                <TableHead className="text-muted-foreground w-20 p-1 text-xs">Vencimento</TableHead>
                <TableHead className="text-muted-foreground p-1 text-xs">Descrição</TableHead>
                <TableHead className="text-muted-foreground w-20 text-right p-1 text-xs">Valor</TableHead>
                <TableHead className="text-muted-foreground w-16 p-1 text-xs">Tipo</TableHead>
                <TableHead className="text-muted-foreground w-10 text-center p-1 text-xs">Exc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingBills.map((bill) => {
                const config = SOURCE_CONFIG[bill.sourceType] || SOURCE_CONFIG.ad_hoc;
                const Icon = config.icon;
                const dueDate = parseDateLocal(bill.dueDate);
                const isOverdue = dueDate < currentDate && !bill.isPaid;
                
                const isEditable = bill.sourceType !== 'loan_installment' && bill.sourceType !== 'insurance_installment';
                
                return (
                  <TableRow 
                    key={bill.id} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors h-8",
                      isOverdue && "bg-destructive/5 hover:bg-destructive/10"
                    )}
                  >
                    <TableCell className="text-center p-1">
                      <Checkbox
                        checked={bill.isPaid}
                        onCheckedChange={(checked) => handleMarkAsPaid(bill, checked as boolean)}
                        className="w-4 h-4"
                      />
                    </TableCell>
                    <TableCell className={cn("font-medium whitespace-nowrap text-xs p-1", isOverdue && "text-destructive")}>
                      <div className="flex items-center gap-1">
                        {isOverdue && <AlertTriangle className="w-3 h-3 text-destructive" />}
                        {formatDate(bill.dueDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate p-1">
                      {bill.description}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive whitespace-nowrap p-1">
                      {isEditable ? (
                        <EditableCell 
                          value={bill.expectedAmount} 
                          type="currency" 
                          onSave={(v) => handleUpdateExpectedAmount(bill, Number(v))}
                          className="text-destructive text-right text-xs"
                        />
                      ) : (
                        formatCurrency(bill.expectedAmount)
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <Badge variant="outline" className={cn("gap-1 text-[10px] px-1 py-0", config.color)}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center p-1">
                      {isEditable && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleExcludeBill(bill)}
                          title="Excluir da lista deste mês"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {pendingBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Check className="w-6 h-6 mx-auto mb-2 text-success" />
                    Todas as contas pendentes foram pagas!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Tabela de Contas Pagas (Compacta) */}
      {paidBills.length > 0 && (
        <div className="glass-card p-3 shrink-0">
          <h3 className="text-sm font-semibold text-foreground mb-2">Contas Pagas ({paidBills.length})</h3>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent h-8">
                  <TableHead className="text-muted-foreground w-10 text-center p-1 text-xs">Pago</TableHead>
                  <TableHead className="text-muted-foreground w-20 p-1 text-xs">Pagamento</TableHead>
                  <TableHead className="text-muted-foreground p-1 text-xs">Descrição</TableHead>
                  <TableHead className="text-muted-foreground w-20 text-right p-1 text-xs">Valor</TableHead>
                  <TableHead className="text-muted-foreground w-16 p-1 text-xs">Tipo</TableHead>
                  <TableHead className="text-muted-foreground w-10 text-center p-1 text-xs">Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paidBills.map((bill) => {
                  const config = SOURCE_CONFIG[bill.sourceType] || SOURCE_CONFIG.ad_hoc;
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={bill.id} className="bg-success/5 hover:bg-success/10 transition-colors h-8">
                      <TableCell className="text-center p-1">
                        <Checkbox
                          checked={bill.isPaid}
                          onCheckedChange={(checked) => handleMarkAsPaid(bill, checked as boolean)}
                          className="w-4 h-4 border-success data-[state=checked]:bg-success"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-success whitespace-nowrap text-xs p-1">
                        {bill.paymentDate ? formatDate(bill.paymentDate) : '-'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate p-1">
                        {bill.description}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success whitespace-nowrap text-xs p-1">
                        {formatCurrency(bill.expectedAmount)}
                      </TableCell>
                      <TableCell className="p-1">
                        <Badge variant="outline" className={cn("gap-1 text-[10px] px-1 py-0", config.color)}>
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center p-1">
                        {/* Botão para ver transação no extrato */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => toast.info(`Transação ID: ${bill.transactionId}`)}
                        >
                          <Info className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}