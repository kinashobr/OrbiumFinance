import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Calendar, DollarSign, Hash, Wallet, Tags, FileText, Check, ArrowRight } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ACCOUNT_TYPE_LABELS, formatCurrency } from "@/types/finance";
import { cn, getDueDate } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

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

    toast.success(`${installmentsCount} parcelas geradas!`);
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

  const installmentPreview = useMemo(() => {
    const amount = parseFloat(formData.totalAmount.replace('.', '').replace(',', '.')) || 0;
    const count = parseInt(formData.installments) || 1;
    return amount / count;
  }, [formData.totalAmount, formData.installments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl">
        <DialogHeader className="px-8 pt-10 pb-6 bg-primary/5">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div>
              <DialogTitle className="text-3xl font-black tracking-tighter">Compra Parcelada</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Provisionamento Automático
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Valor Principal - Foco Total */}
          <div className="text-center space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor Total da Compra</Label>
            <div className="relative max-w-xs mx-auto">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground/30">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={formData.totalAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-20 text-5xl font-black text-center border-none bg-transparent focus-visible:ring-0 p-0"
              />
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mt-2"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Descrição do Item</Label>
                <Input
                  placeholder="Ex: iPhone 15 Pro Max"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="h-12 border-2 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Parcelas</Label>
                  <Input
                    type="number"
                    value={formData.installments}
                    onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                    className="h-12 border-2 rounded-xl font-black text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">1º Vencimento</Label>
                  <Input
                    type="date"
                    value={formData.firstDueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstDueDate: e.target.value }))}
                    className="h-12 border-2 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Conta de Débito</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}>
                  <SelectTrigger className="h-12 border-2 rounded-xl font-bold">
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id} className="font-medium">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Categoria</Label>
                <Select value={formData.categoryId} onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}>
                  <SelectTrigger className="h-12 border-2 rounded-xl font-bold">
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-medium">
                        {c.icon} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Preview de Parcelamento */}
          {installmentPreview > 0 && (
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center text-primary shadow-sm">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor por Parcela</p>
                  <p className="text-xl font-black text-foreground">{formatCurrency(installmentPreview)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Término Previsto</p>
                <p className="text-sm font-bold text-foreground">
                  {format(getDueDate(formData.firstDueDate, parseInt(formData.installments) || 1), 'MMMM yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button 
              type="submit"
              className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl shadow-primary/20 gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              GERAR {formData.installments} PARCELAS <ArrowRight className="w-6 h-6" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}