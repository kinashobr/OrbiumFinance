import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BillTracker, Categoria, ContaCorrente, BillSourceType, formatCurrency } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";

interface BillFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: BillTracker;
  onSubmit: (bill: Omit<BillTracker, "id" | "isPaid" | "type" | "isExcluded">) => void;
  onUpdate: (id: string, updates: Partial<BillTracker>) => void;
  onDelete: (id: string) => void;
  accounts: ContaCorrente[];
  categories: Categoria[];
}

export function BillFormModal({
  open,
  onOpenChange,
  bill,
  onSubmit,
  onUpdate,
  onDelete,
  accounts,
  categories,
}: BillFormModalProps) {
  const isEditing = !!bill;
  
  const [description, setDescription] = useState(bill?.description || "");
  const [expectedAmount, setExpectedAmount] = useState(bill?.expectedAmount.toFixed(2) || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(bill?.dueDate ? parseDateLocal(bill.dueDate) : new Date());
  const [suggestedAccountId, setSuggestedAccountId] = useState(bill?.suggestedAccountId || accounts.find(c => c.accountType === 'corrente')?.id || "");
  const [suggestedCategoryId, setSuggestedCategoryId] = useState(bill?.suggestedCategoryId || "");
  // Removido o estado sourceType, pois será derivado da categoria

  useEffect(() => {
    if (open && bill) {
      setDescription(bill.description);
      setExpectedAmount(bill.expectedAmount.toFixed(2));
      setDueDate(parseDateLocal(bill.dueDate));
      setSuggestedAccountId(bill.suggestedAccountId || accounts.find(c => c.accountType === 'corrente')?.id || "");
      setSuggestedCategoryId(bill.suggestedCategoryId || "");
    } else if (open && !bill) {
      // Reset for new bill
      setDescription("");
      setExpectedAmount("");
      setDueDate(new Date());
      setSuggestedAccountId(accounts.find(c => c.accountType === 'corrente')?.id || "");
      setSuggestedCategoryId("");
    }
  }, [open, bill, accounts]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d,]/g, '');
    setExpectedAmount(value);
  };

  const handleSubmit = () => {
    const amount = parseFloat(expectedAmount.replace(',', '.'));
    if (!description || isNaN(amount) || amount <= 0 || !dueDate || !suggestedAccountId || !suggestedCategoryId) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    
    const category = categories.find(c => c.id === suggestedCategoryId);
    
    // Determina o sourceType baseado na natureza da categoria
    let finalSourceType: BillSourceType = 'ad_hoc';
    if (category?.nature === 'despesa_fixa') {
        finalSourceType = 'fixed_expense';
    } else if (category?.nature === 'despesa_variavel') {
        finalSourceType = 'variable_expense';
    } else if (category?.nature === 'despesa_avulsa') {
        finalSourceType = 'ad_hoc';
    }
    
    const newBillData: Omit<BillTracker, "id" | "isPaid" | "type" | "isExcluded"> = {
      description,
      expectedAmount: amount,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      suggestedAccountId,
      suggestedCategoryId,
      sourceType: finalSourceType, // Definido pela categoria
      sourceRef: 'manual',
      parcelaNumber: 0,
    };

    if (isEditing && bill) {
      onUpdate(bill.id, newBillData);
      toast.success("Conta a pagar atualizada.");
    } else {
      onSubmit(newBillData);
      toast.success("Nova conta a pagar adicionada.");
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (bill && window.confirm("Tem certeza que deseja excluir esta conta a pagar?")) {
      onDelete(bill.id);
      onOpenChange(false);
      toast.success("Conta a pagar excluída.");
    }
  };
  
  // Filtra apenas categorias de despesa relevantes para contas a pagar
  const filteredCategories = categories.filter(c => 
    c.nature === 'despesa_fixa' || 
    c.nature === 'despesa_variavel' || 
    c.nature === 'despesa_avulsa'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Conta a Pagar" : "Adicionar Nova Conta"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel, Conta de Luz, etc."
            />
          </div>
          
          {/* Valor e Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor Esperado</Label>
              <Input
                id="amount"
                value={expectedAmount}
                onChange={handleAmountChange}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Conta Sugerida */}
          <div className="space-y-2">
            <Label htmlFor="account">Conta de Pagamento Sugerida</Label>
            <Select value={suggestedAccountId} onValueChange={setSuggestedAccountId}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(c => c.accountType === 'corrente').map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Categoria Sugerida (Define o tipo Fixa/Variável/Avulsa) */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria (Define o Tipo de Despesa)</Label>
            <Select value={suggestedCategoryId} onValueChange={setSuggestedCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label} ({category.nature === 'despesa_fixa' ? 'Fixa' : category.nature === 'despesa_variavel' ? 'Variável' : 'Avulsa'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
        </div>
        <DialogFooter className="flex sm:justify-between">
          {isEditing && (
            <Button variant="destructive" onClick={handleDelete} className="gap-2">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          )}
          <Button onClick={handleSubmit} className="gap-2 ml-auto">
            <Save className="w-4 h-4" /> {isEditing ? "Salvar Alterações" : "Adicionar Conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}