import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Plus, Trash2, Check, Clock, AlertTriangle, DollarSign, Building2, Shield, Repeat, Info, X, TrendingDown } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillTracker, BillSourceType, formatCurrency, TransacaoCompleta, getDomainFromOperation, generateTransactionId } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditableCell } from "../EditableCell";

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
  variable_expense: { icon: DollarSign, color: 'text-warning', label: 'Variável' },
  ad_hoc: { icon: Info, color: 'text-primary', label: 'Avulsa' },
};

// Define column keys and initial widths (in pixels)
const COLUMN_KEYS = ['pay', 'due', 'description', 'account', 'type', 'amount', 'actions'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const INITIAL_WIDTHS: Record<ColumnKey, number> = {
  pay: 40,
  due: 80,
  description: 300, // Start wide
  account: 112, // w-28
  type: 64, // w-16
  amount: 80,
  actions: 40,
};

const columnHeaders: { key: ColumnKey, label: string, align?: 'center' | 'right' }[] = [
  { key: 'pay', label: 'Pagar', align: 'center' },
  { key: 'due', label: 'Vencimento' },
  { key: 'description', label: 'Descrição' },
  { key: 'account', label: 'Conta Pgto' },
  { key: 'type', label: 'Tipo' },
  { key: 'amount', label: 'Valor', align: 'right' },
  { key: 'actions', label: 'Ações', align: 'center' },
];

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
  
  const [adHocType, setAdHocType] = useState<'fixed_expense' | 'variable_expense'>('variable_expense');

  // --- Column Resizing State and Logic ---
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    try {
      const saved = localStorage.getItem('bills_column_widths');
      return saved ? JSON.parse(saved) : INITIAL_WIDTHS;
    } catch {
      return INITIAL_WIDTHS;
    }
  });
  
  useEffect(() => {
    localStorage.setItem('bills_column_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  const [resizingColumn, setResizingColumn] = useState<ColumnKey | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = (e: React.MouseEvent, key: ColumnKey) => {
    e.preventDefault();
    setResizingColumn(key);
    setStartX(e.clientX);
    setStartWidth(columnWidths[key]);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(30, startWidth + deltaX); // Minimum width of 30px

    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth,
    }));
  }, [resizingColumn, startX, startWidth]);

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null);
  }, []);

  useEffect(() => {
    if (resizingColumn) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [resizingColumn, handleMouseMove, handleMouseUp]);
  
  const totalWidth = useMemo(() => {
    return Object.values(columnWidths).reduce((sum, w) => sum + w, 0);
  }, [columnWidths]);
  // ---------------------------------------------

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
    
    const suggestedCategoryId = categoriasV2.find(c => 
        (adHocType === 'fixed_expense' && c.nature === 'despesa_fixa') ||
        (adHocType === 'variable_expense' && c.nature === 'despesa_variavel')
    )?.id;

    onAddBill({
      description: newBillData.description,
      dueDate: newBillData.dueDate,
      expectedAmount: amount,
      sourceType: adHocType,
      suggestedAccountId: contasMovimento.find(c => c.accountType === 'conta_corrente')?.id,
      suggestedCategoryId: suggestedCategoryId,
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
  
  const handleUpdateSuggestedAccount = (bill: BillTracker, newAccountId: string) => {
    onUpdateBill(bill.id, { suggestedAccountId: newAccountId });
    toast.success("Conta de pagamento sugerida atualizada!");
  };

  const handleMarkAsPaid = useCallback((bill: BillTracker, isChecked: boolean) => {
    if (!isChecked) {
      // Reverter pagamento
      if (bill.transactionId) {
        if (bill.sourceType === 'loan_installment' && bill.sourceRef && bill.parcelaNumber) {
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
        
        setTransacoesV2(prev => prev.filter(t => t.id !== bill.transactionId));
        
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

    addTransacaoV2(newTransaction);
    
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

    onUpdateBill(bill.id, { isPaid: true, paymentDate, transactionId });
    toast.success(`Conta "${bill.description}" paga e registrada!`);

  }, [addTransacaoV2, onUpdateBill, categoriasV2, contasMovimento, currentDate, markLoanParcelPaid, markSeguroParcelPaid, unmarkLoanParcelPaid, unmarkSeguroParcelPaid, setTransacoesV2]);

  const sortedBills = useMemo(() => {
    const filtered = bills.filter(b => !b.isExcluded);
    
    const pending = filtered.filter(b => !b.isPaid);
    const paid = filtered.filter(b => b.isPaid);
    
    pending.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
    paid.sort((a, b) => parseDateLocal(b.paymentDate || b.dueDate).getTime() - parseDateLocal(a.paymentDate || a.dueDate).getTime());
    
    return [...pending, ...paid];
  }, [bills]);
  
  const totalPending = sortedBills.filter(b => !b.isPaid).reduce((acc, b) => acc + b.expectedAmount, 0);

  const formatDate = (dateStr: string) => {
    const date = parseDateLocal(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };
  
  const availableAccounts = useMemo(() => 
    contasMovimento.filter(c => c.accountType === 'conta_corrente' || c.accountType === 'cartao_credito'),
    [contasMovimento]
  );
  
  const accountOptions = useMemo(() => 
    availableAccounts.map(a => ({ value: a.id, label: a.name })),
    [availableAccounts]
  );

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Adição Rápida (Ad-Hoc) - SEMPRE VISÍVEL E MINIMALISTA */}
      <div className="glass-card p-3 shrink-0">
        <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-end mb-2">
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
        
        {/* Seleção de Tipo para Ad-Hoc */}
        <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Tipo de Despesa:</Label>
            <Button
                variant={adHocType === 'fixed_expense' ? "default" : "outline"}
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                onClick={() => setAdHocType('fixed_expense')}
            >
                <Repeat className="w-3 h-3" /> Fixa
            </Button>
            <Button
                variant={adHocType === 'variable_expense' ? "default" : "outline"}
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                onClick={() => setAdHocType('variable_expense')}
            >
                <TrendingDown className="w-3 h-3" /> Variável
            </Button>
        </div>
      </div>

      {/* Tabela de Contas (Consolidada) */}
      <div className="glass-card p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Contas do Mês ({sortedBills.length})</h3>
          <Badge variant="destructive" className="text-xs">
            Pendentes: {formatCurrency(totalPending)}
          </Badge>
        </div>
        
        <div className="rounded-lg border border-border overflow-y-auto flex-1 min-h-[100px]">
          <Table style={{ minWidth: `${totalWidth}px` }}>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent h-8">
                {columnHeaders.map((header) => (
                  <TableHead 
                    key={header.key} 
                    className={cn(
                      "text-muted-foreground p-1 text-xs relative",
                      header.align === 'center' && 'text-center',
                      header.align === 'right' && 'text-right'
                    )}
                    style={{ width: columnWidths[header.key] }}
                  >
                    {header.label}
                    {/* Resizer Handle */}
                    {header.key !== 'actions' && (
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
                        onMouseDown={(e) => handleMouseDown(e, header.key)}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBills.map((bill) => {
                const config = SOURCE_CONFIG[bill.sourceType] || SOURCE_CONFIG.ad_hoc;
                const Icon = config.icon;
                const dueDate = parseDateLocal(bill.dueDate);
                const isOverdue = dueDate < currentDate && !bill.isPaid;
                const isPaid = bill.isPaid;
                
                const isEditable = bill.sourceType !== 'loan_installment' && bill.sourceType !== 'insurance_installment';
                
                return (
                  <TableRow 
                    key={bill.id} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors h-8",
                      isOverdue && "bg-destructive/5 hover:bg-destructive/10",
                      isPaid && "bg-success/5 hover:bg-success/10 border-l-4 border-success/50"
                    )}
                  >
                    <TableCell className="text-center p-1" style={{ width: columnWidths.pay }}>
                      <Checkbox
                        checked={isPaid}
                        onCheckedChange={(checked) => handleMarkAsPaid(bill, checked as boolean)}
                        className={cn("w-4 h-4", isPaid && "border-success data-[state=checked]:bg-success")}
                      />
                    </TableCell>
                    
                    <TableCell className={cn("font-medium whitespace-nowrap text-xs p-1", isOverdue && "text-destructive")} style={{ width: columnWidths.due }}>
                      <div className="flex items-center gap-1">
                        {isOverdue && <AlertTriangle className="w-3 h-3 text-destructive" />}
                        {isPaid ? formatDate(bill.paymentDate!) : formatDate(bill.dueDate)}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-xs max-w-[200px] truncate p-1" style={{ width: columnWidths.description }}>
                      {bill.description}
                    </TableCell>
                    
                    <TableCell className="text-xs p-1" style={{ width: columnWidths.account }}>
                      <Select 
                        value={bill.suggestedAccountId || ''} 
                        onValueChange={(v) => handleUpdateSuggestedAccount(bill, v)}
                        disabled={isPaid}
                      >
                        <SelectTrigger className="h-6 text-xs p-1 w-full">
                          <SelectValue placeholder="Conta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell className="p-1" style={{ width: columnWidths.type }}>
                      <Badge variant="outline" className={cn("gap-1 text-[10px] px-1 py-0", config.color)}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className={cn("text-right font-semibold whitespace-nowrap p-1", isPaid ? "text-success" : "text-destructive")} style={{ width: columnWidths.amount }}>
                      {isEditable && !isPaid ? (
                        <EditableCell 
                          value={bill.expectedAmount} 
                          type="currency" 
                          onSave={(v) => handleUpdateExpectedAmount(bill, Number(v))}
                          className={cn("text-right text-xs", isPaid ? "text-success" : "text-destructive")}
                        />
                      ) : (
                        formatCurrency(bill.expectedAmount)
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center p-1" style={{ width: columnWidths.actions }}>
                      {isEditable && !isPaid && (
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
                      {isPaid && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground"
                            onClick={() => toast.info(`Transação ID: ${bill.transactionId}`)}
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <Check className="w-6 h-6 mx-auto mb-2 text-success" />
                    Nenhuma conta pendente ou paga neste mês.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}