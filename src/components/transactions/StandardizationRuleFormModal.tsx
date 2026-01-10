import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Calendar, DollarSign, Hash, Wallet, Tags, FileText, Check, X } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ACCOUNT_TYPE_LABELS, CATEGORY_NATURE_LABELS } from "@/types/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { OperationType } from "@/types/finance";

// Define and export the constant
export const STANDARDIZABLE_OPERATIONS: { value: OperationType; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { value: 'receita', label: 'Receita', icon: Plus, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'despesa', label: 'Despesa', icon: Minus, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'transferencia', label: 'Transferência', icon: ArrowLeftRight, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'aplicacao', label: 'Aplicação', icon: TrendingUp, color: 'text-accent', bgColor: 'bg-accent/10' },
  { value: 'resgate', label: 'Resgate', icon: TrendingDown, color: 'text-warning', bgColor: 'bg-warning/10' },
  { value: 'pagamento_emprestimo', label: 'Pag. Empréstimo', icon: CreditCard, color: 'text-warning', bgColor: 'bg-warning/10' },
  { value: 'liberacao_emprestimo', label: 'Liberação', icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'veiculo', label: 'Veículo', icon: Car, color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'rendimento', label: 'Rendimento', icon: Coins, color: 'text-primary', bgColor: 'bg-primary/10' },
];

interface AddPurchaseInstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
}

export function AddPurchaseInstallmentDialog({
  open,
  onOpenChange,
  currentDate,
}: AddPurchaseInstallmentDialogProps) {
  const { contasMovimento, categoriasV2, addPurchaseInstallments } = useFinance();
  
  const [formData, setFormData] = useState({
    description: "",
    totalAmount: "",
    installments: "12",
    firstDueDate: format(currentDate, 'yyyy-MM-dd'),
    accountId: "",
    categoryId: "",
  });

  const availableAccounts = useMemo(() => 
    contasMovimento.filter(c => c.accountType === 'corrente' || c.accountType === 'cartao_credito'),
    [contasMovimento]
  );

  const expenseCategories = useMemo(() => 
    categoriasV2.filter(c => c.nature === 'despesa_fixa' || c.nature === 'despesa_variavel'),
    [categoriasV2]
  );

  const handleAmountChange = (value: string) => {
    let cleaned = value.replace(/[^\d,]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) cleaned = parts[0] + ',' + parts.slice(1).join('');
    setFormData(prev => ({ ...prev, totalAmount: cleaned }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.totalAmount.replace('.', '').replace(',', '.'));
    const installmentsCount = parseInt(formData.installments);

    if (!formData.description || isNaN(amount) || amount <= 0 || isNaN(installmentsCount) || installmentsCount <= 0) {
      toast.error("Preencha todos os campos obrigatórios corretamente.");
      return;
    }

    addPurchaseInstallments({
      description: formData.description,
      totalAmount: amount,
      installments: installmentsCount,
      firstDueDate: formData.firstDueDate,
      suggestedAccountId: formData.accountId || undefined,
      suggestedCategoryId: formData.categoryId || undefined,
    });

    toast.success(`${installmentsCount} parcelas geradas com sucesso!`);
    onOpenChange(false);
    setFormData({
      description: "",
      totalAmount: "",
      installments: "12",
      firstDueDate: format(currentDate, 'yyyy-MM-dd'),
      accountId: "",
      categoryId: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        {/* Cabeçalho no padrão Nova Movimentação */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                Nova Compra Parcelada
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Registre uma compra e gere as parcelas automaticamente no Contas a Pagar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6 mt-4">
          {/* Seção 1: Dados da Compra */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Valor Total */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Valor Total *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={formData.totalAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-12 pl-10 text-lg font-semibold border-2 rounded-xl"
                  />
                </div>
              </div>

              {/* Número de Parcelas */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" /> Qtd. Parcelas *
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={formData.installments}
                    onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                    className="h-12 pl-10 border-2 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primeira Parcela */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 1º Vencimento *
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.firstDueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstDueDate: e.target.value }))}
                    className="h-12 pl-10 border-2 rounded-xl"
                  />
                </div>
              </div>

              {/* Conta Sugerida */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Conta Sugerida
                </Label>
                <Select 
                  value={formData.accountId} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}
                >
                  <SelectTrigger className="h-12 border-2 rounded-xl">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({ACCOUNT_TYPE_LABELS[a.accountType]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seção 2: Classificação */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Tags className="w-4 h-4 text-primary" /> Classificação e Detalhes
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Categoria */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Categoria Sugerida</Label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}
                >
                  <SelectTrigger className="h-12 border-2 rounded-xl">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Descrição da Compra *</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: Novo Smartphone"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="h-12 pl-10 border-2 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 rounded-xl border-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="flex-1 h-12 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
              >
                <Check className="w-5 h-5 mr-2" />
                Gerar Parcelas
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}