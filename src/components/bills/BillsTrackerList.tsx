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
import { Plus, Trash2, Check, Clock, AlertTriangle, DollarSign, Building2, Shield, Repeat, Info, X, TrendingDown, CheckCircle2, ShoppingCart } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillTracker, BillSourceType, formatCurrency, CATEGORY_NATURE_LABELS, BillDisplayItem, ExternalPaidBill } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditableCell } from "../EditableCell";

interface BillsTrackerListProps {
  bills: BillDisplayItem[];
  onUpdateBill: (id: string, updates: Partial<BillTracker>) => void;
  onDeleteBill: (id: string) => void;
  onAddBill: (bill: Omit<BillTracker, "id" | "isPaid" | "type">) => void;
  onTogglePaid: (bill: BillTracker, isChecked: boolean) => void;
  currentDate: Date;
}

const SOURCE_CONFIG: Record<BillSourceType | 'external_expense', { icon: React.ElementType; color: string; label: string }> = {
  loan_installment: { icon: Building2, color: 'text-orange-500', label: 'Emp.' },
  insurance_installment: { icon: Shield, color: 'text-blue-500', label: 'Seg.' },
  fixed_expense: { icon: Repeat, color: 'text-purple-500', label: 'Fixa' },
  variable_expense: { icon: DollarSign, color: 'text-warning', label: 'Var.' },
  ad_hoc: { icon: Info, color: 'text-primary', label: 'Avu.' },
  purchase_installment: { icon: ShoppingCart, color: 'text-pink-500', label: 'Parc.' },
  external_expense: { icon: CheckCircle2, color: 'text-success', label: 'Extr.' },
};

const COLUMN_KEYS = ['pay', 'due', 'paymentDate', 'description', 'account', 'type', 'category', 'amount', 'actions'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const INITIAL_WIDTHS: Record<ColumnKey, number> = {
  pay: 50,
  due: 90,
  paymentDate: 90,
  description: 240,
  account: 140,
  type: 80,
  category: 160,
  amount: 110,
  actions: 60,
};

const columnHeaders: { key: ColumnKey, label: string, align?: 'center' | 'right' }[] = [
  { key: 'pay', label: 'Pagar', align: 'center' },
  { key: 'due', label: 'Venc.' },
  { key: 'paymentDate', label: 'Pago em' },
  { key: 'description', label: 'Descrição' },
  { key: 'account', label: 'Conta Pagamento' },
  { key: 'type', label: 'Origem' },
  { key: 'category', label: 'Categoria' },
  { key: 'amount', label: 'Valor', align: 'right' },
  { key: 'actions', label: 'Ações', align: 'center' },
];

const isBillTracker = (bill: BillDisplayItem): bill is BillTracker => bill.type === 'tracker';
const isExternalPaidBill = (bill: BillDisplayItem): bill is ExternalPaidBill => bill.type === 'external_paid';

export function BillsTrackerList({
  bills,
  onUpdateBill,
  onDeleteBill,
  onAddBill,
  onTogglePaid,
  currentDate,
}: BillsTrackerListProps) {
  const { categoriasV2, contasMovimento, setBillsTracker } = useFinance();
  
  const [newBillData, setNewBillData] = useState({
    description: '',
    amount: '',
    dueDate: format(currentDate, 'yyyy-MM-dd'),
  });

  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    try {
      const saved = localStorage.getItem('bills_column_widths_v2');
      return saved ? JSON.parse(saved) : INITIAL_WIDTHS;
    } catch {
      return INITIAL_WIDTHS;
    }
  });
  
  useEffect(() => {
    localStorage.setItem('bills_column_widths_v2', JSON.stringify(columnWidths));
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
    const newWidth = Math.max(30, startWidth + deltaX);
    setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
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
  
  const totalWidth = useMemo(() => Object.values(columnWidths).reduce((sum, w) => sum + w, 0), [columnWidths]);

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
      suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id,
      suggestedCategoryId: null,
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
    toast.info(`Conta "${bill.description}" excluída.`);
  };

  const sortedBills = useMemo(() => {
    const trackerBills = bills.filter(isBillTracker).filter(b => !b.isExcluded);
    const externalBills = bills.filter(isExternalPaidBill);
    const pending = trackerBills.filter(b => !b.isPaid);
    const paidTracker = trackerBills.filter(b => b.isPaid);
    const allPaid: BillDisplayItem[] = [...paidTracker, ...externalBills];
    pending.sort((a, b) => parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime());
    allPaid.sort((a, b) => parseDateLocal(b.paymentDate || b.dueDate).getTime() - parseDateLocal(a.paymentDate || a.dueDate).getTime());
    return [...pending, ...allPaid];
  }, [bills]);
  
  const formatDate = (dateStr: string) => {
    const date = parseDateLocal(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  
  const availableAccounts = useMemo(() => 
    contasMovimento.filter(c => c.accountType === 'corrente' || c.accountType === 'cartao_credito'),
    [contasMovimento]
  );
  
  const expenseCategories = useMemo(() => 
    categoriasV2.filter(c => c.nature === 'despesa_fixa' || c.nature === 'despesa_variavel'),
    [categoriasV2]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Adição Rápida mais compacta */}
      <div className="px-5 py-3 border-b bg-muted/5">
        <div className="flex items-end gap-3 max-w-4xl">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground ml-1">Descrição</Label>
            <Input
              value={newBillData.description}
              onChange={(e) => setNewBillData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Nova conta avulsa..."
              className="h-9 text-xs"
            />
          </div>
          <div className="w-[140px] space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground ml-1">Valor (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={newBillData.amount}
              onChange={(e) => setNewBillData(prev => ({ ...prev, amount: formatAmount(e.target.value) }))}
              placeholder="0,00"
              className="h-9 text-xs"
            />
          </div>
          <div className="w-[140px] space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground ml-1">Vencimento</Label>
            <Input
              type="date"
              value={newBillData.dueDate}
              onChange={(e) => setNewBillData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>
          <Button 
            onClick={handleAddAdHocBill} 
            className="h-9 w-9 p-0"
            disabled={!newBillData.description || parseAmount(newBillData.amount) <= 0 || !newBillData.dueDate}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabela com Scroll Interno e densidade otimizada */}
      <div className="flex-1 overflow-auto min-h-0 bg-background custom-scrollbar">
        <Table style={{ minWidth: `${totalWidth}px`, tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
            <TableRow className="hover:bg-transparent border-b h-10">
              {columnHeaders.map((header) => (
                <TableHead 
                  key={header.key} 
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-3 py-2 relative",
                    header.align === 'center' && 'text-center',
                    header.align === 'right' && 'text-right'
                  )}
                  style={{ width: columnWidths[header.key] }}
                >
                  {header.label}
                  {header.key !== 'actions' && (
                    <div
                      className="absolute right-0 top-1/4 h-1/2 w-[1px] bg-border cursor-col-resize hover:w-[3px] transition-all"
                      onMouseDown={(e) => handleMouseDown(e, header.key)}
                    />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBills.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={columnHeaders.length} className="h-32 text-center text-muted-foreground text-xs italic">
                        Nenhuma conta registrada para este mês.
                    </TableCell>
                </TableRow>
            ) : (
                sortedBills.map((bill) => {
                    const isExternalPaid = isExternalPaidBill(bill);
                    const config = SOURCE_CONFIG[bill.sourceType] || SOURCE_CONFIG.ad_hoc;
                    const Icon = config.icon;
                    const dueDate = parseDateLocal(bill.dueDate);
                    const isOverdue = dueDate < currentDate && !bill.isPaid;
                    const isPaid = bill.isPaid;
                    const isAmountEditable = isBillTracker(bill) && bill.sourceType !== 'loan_installment' && bill.sourceType !== 'insurance_installment';
                    const isDateEditable = isBillTracker(bill) && !isPaid;
                    const isCategoryEditable = isBillTracker(bill) && (bill.sourceType === 'ad_hoc' || bill.sourceType === 'fixed_expense' || bill.sourceType === 'variable_expense' || bill.sourceType === 'purchase_installment') && !isPaid;
                    const currentCategory = expenseCategories.find(c => c.id === bill.suggestedCategoryId);
                    
                    return (
                        <TableRow 
                            key={bill.id} 
                            className={cn(
                                "group border-b h-11 transition-colors",
                                isExternalPaid && "bg-muted/5 opacity-80",
                                isOverdue && "bg-destructive/5 hover:bg-destructive/10",
                                isPaid && !isExternalPaid && "bg-success/5 border-l-2 border-l-success"
                            )}
                        >
                            <TableCell className="text-center p-0" style={{ width: columnWidths.pay }}>
                                <div className="flex justify-center">
                                    {isExternalPaid ? (
                                        <CheckCircle2 className="w-4 h-4 text-success/60" />
                                    ) : (
                                        <Checkbox
                                            checked={isPaid}
                                            onCheckedChange={(checked) => onTogglePaid(bill as BillTracker, checked as boolean)}
                                            className={cn("h-4 w-4", isPaid && "border-success data-[state=checked]:bg-success")}
                                        />
                                    )}
                                </div>
                            </TableCell>
                            
                            <TableCell className="px-3" style={{ width: columnWidths.due }}>
                                <div className="flex items-center gap-1.5">
                                    {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                                    {isDateEditable ? (
                                        <EditableCell
                                            value={bill.dueDate}
                                            type="date"
                                            onSave={(v) => onUpdateBill(bill.id, { dueDate: String(v) })}
                                            className={cn("text-xs font-medium", isOverdue && "text-destructive")}
                                        />
                                    ) : (
                                        <span className={cn("text-xs font-medium", isOverdue && "text-destructive", isExternalPaid && "text-muted-foreground")}>
                                            {formatDate(bill.dueDate)}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            
                            <TableCell className="px-3" style={{ width: columnWidths.paymentDate }}>
                                {isPaid && bill.paymentDate ? (
                                    <span className={cn("text-xs", isExternalPaid ? "text-muted-foreground/60" : "text-success/80 font-medium")}>
                                        {formatDate(bill.paymentDate)}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/40">—</span>
                                )}
                            </TableCell>
                            
                            <TableCell className="px-3 overflow-hidden" style={{ width: columnWidths.description }}>
                                <span className="text-xs font-medium text-foreground block truncate" title={bill.description}>
                                    {bill.description}
                                </span>
                            </TableCell>
                            
                            <TableCell className="px-2" style={{ width: columnWidths.account }}>
                                <Select 
                                    value={bill.suggestedAccountId || ''} 
                                    onValueChange={(v) => onUpdateBill(bill.id, { suggestedAccountId: v })}
                                    disabled={isPaid || isExternalPaid}
                                >
                                    <SelectTrigger className="h-7 text-[10px] border-none bg-transparent hover:bg-muted/50 p-1.5 focus:ring-0">
                                        <SelectValue placeholder="Conta..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAccounts.map(a => (
                                            <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            
                            <TableCell className="px-2" style={{ width: columnWidths.type }}>
                                <Badge variant="outline" className={cn("text-[10px] font-bold px-1.5 py-0 h-5 border-none bg-transparent", config.color)}>
                                    <Icon className="w-3 h-3 mr-1" />
                                    {config.label}
                                </Badge>
                            </TableCell>
                            
                            <TableCell className="px-2" style={{ width: columnWidths.category }}>
                                <Select 
                                    value={bill.suggestedCategoryId || ''} 
                                    onValueChange={(v) => onUpdateBill(bill.id, { suggestedCategoryId: v })}
                                    disabled={!isCategoryEditable || isExternalPaid}
                                >
                                    <SelectTrigger className="h-7 text-[10px] border-none bg-transparent hover:bg-muted/50 p-1.5 focus:ring-0">
                                        <SelectValue placeholder={currentCategory?.label || "Selecione..."} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {expenseCategories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                                {cat.icon} {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            
                            <TableCell className="px-3 text-right" style={{ width: columnWidths.amount }}>
                                {isAmountEditable && !isPaid ? (
                                    <EditableCell 
                                        value={bill.expectedAmount} 
                                        type="currency" 
                                        onSave={(v) => onUpdateBill(bill.id, { expectedAmount: Number(v) })}
                                        className="text-right text-xs font-bold text-destructive"
                                    />
                                ) : (
                                    <span className={cn("text-xs font-bold", isPaid ? "text-success" : "text-destructive", isExternalPaid && "text-muted-foreground/80")}>
                                        {formatCurrency(bill.expectedAmount)}
                                    </span>
                                )}
                            </TableCell>
                            
                            <TableCell className="px-2 text-center" style={{ width: columnWidths.actions }}>
                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isBillTracker(bill) && !isPaid && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleExcludeBill(bill)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    )}
                                    {isPaid && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => toast.info(`Lançamento vinculado ao ID: ${bill.id}`)}>
                                            <Info className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}