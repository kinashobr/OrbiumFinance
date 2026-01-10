import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Trash2, Tags, AlertCircle, Edit2, Search, X, Check, ArrowRight, Settings2 } from "lucide-react";
import { StandardizationRule, Categoria, OPERATION_TYPE_LABELS, CATEGORY_NATURE_LABELS } from "@/types/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { useFinance } from "@/contexts/FinanceContext";

interface StandardizationRuleManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: StandardizationRule[];
  onDeleteRule: (id: string) => void;
  categories: Categoria[];
}

export function StandardizationRuleManagerModal({
  open,
  onOpenChange,
  rules,
  onDeleteRule,
  categories,
}: StandardizationRuleManagerModalProps) {
  const { addStandardizationRule } = useFinance(); // We'll need a proper update function, but let's use context logic
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRule, setEditingRule] = useState<StandardizationRule | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const filteredRules = useMemo(() => {
    if (!searchTerm) return rules;
    const lower = searchTerm.toLowerCase();
    return rules.filter(r => 
        r.pattern.toLowerCase().includes(lower) || 
        r.descriptionTemplate.toLowerCase().includes(lower)
    );
  }, [rules, searchTerm]);

  const handleDelete = (rule: StandardizationRule) => {
    if (window.confirm(`Tem certeza que deseja excluir a regra para o padrão "${rule.pattern}"?`)) {
      onDeleteRule(rule.id);
      toast.success("Regra excluída.");
    }
  };

  const handleEdit = (rule: StandardizationRule) => {
    setEditingRule(rule);
    setShowEditModal(true);
  };

  const handleSaveEditedRule = (updatedRule: Omit<StandardizationRule, "id">) => {
    if (!editingRule) return;
    
    // Simplificado: Remove a antiga e adiciona a nova (já que não temos updateRule explícito no context type ainda)
    onDeleteRule(editingRule.id);
    addStandardizationRule(updatedRule);
    
    setShowEditModal(false);
    setEditingRule(null);
    toast.success("Regra atualizada com sucesso!");
  };

  return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-[min(95vw,64rem)] h-[min(90vh,800px)] flex flex-col p-0 border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden">
            <DialogHeader className="shrink-0 px-8 pt-8 pb-6 bg-primary/10">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                  <Settings2 className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Regras de Padronização</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    Defina como descrições bancárias confusas devem ser lidas pelo sistema.
                  </DialogDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>

            <div className="px-8 py-4 flex items-center justify-between gap-4 border-b border-border/40">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filtrar regras..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 rounded-full bg-muted/30 border-border/40"
                    />
                </div>
                <Badge variant="outline" className="h-8 px-4 rounded-full font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                    {filteredRules.length} {filteredRules.length === 1 ? 'Regra' : 'Regras'}
                </Badge>
            </div>

            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="px-8 py-4">
                        <div className="rounded-[2rem] border border-border/40 overflow-hidden bg-muted/10">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-border/30">
                                        <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-6 h-12">Padrão Detectado</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Conversão</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Ação Automática</TableHead>
                                        <TableHead className="text-right px-6 h-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRules.map((rule) => {
                                        const category = rule.categoryId ? categoriesMap.get(rule.categoryId) : null;
                                        return (
                                            <TableRow key={rule.id} className="border-border/20 hover:bg-muted/20 transition-colors">
                                                <TableCell className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <Pin className="w-3.5 h-3.5 text-primary/50" />
                                                        <p className="text-sm font-bold text-foreground font-mono" title={rule.pattern}>
                                                            {rule.pattern}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                        <p className="text-sm font-medium text-foreground italic" title={rule.descriptionTemplate}>
                                                            "{rule.descriptionTemplate}"
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Badge variant="outline" className="w-fit text-[9px] font-black uppercase border-none bg-primary/10 text-primary">
                                                            {OPERATION_TYPE_LABELS[rule.operationType] || rule.operationType}
                                                        </Badge>
                                                        {category ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
                                                                <span className="text-base">{category.icon}</span>
                                                                <span className="font-medium">{category.label}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground ml-1 opacity-50 italic">
                                                                — Sem categoria
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                            onClick={() => handleEdit(rule)}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDelete(rule)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {filteredRules.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-24 opacity-40">
                                                <Settings2 className="w-16 h-16 mx-auto mb-4" />
                                                <p className="text-lg font-bold uppercase tracking-widest">Nenhuma regra encontrada</p>
                                                <p className="text-xs mt-2">Crie regras durante a revisão de extratos.</p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </ScrollArea>
            </div>

            <DialogFooter className="shrink-0 px-8 py-6 border-t border-border/40">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-12 px-8 rounded-2xl font-bold border-border/60 hover:bg-muted"
              >
                Fechar Gerenciador
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição (Usa o mesmo form que a criação) */}
        {editingRule && (
            <StandardizationRuleFormModal
                open={showEditModal}
                onOpenChange={setShowEditModal}
                initialTransaction={{
                    id: editingRule.id,
                    originalDescription: editingRule.pattern,
                    description: editingRule.descriptionTemplate,
                    operationType: editingRule.operationType,
                    categoryId: editingRule.categoryId,
                    accountId: '', // Mock data needed for the form
                    date: '',
                    amount: 0,
                    isTransfer: editingRule.operationType === 'transferencia',
                    destinationAccountId: null,
                    tempInvestmentId: null,
                    tempLoanId: null,
                    tempParcelaId: null,
                    tempVehicleOperation: null,
                    sourceType: 'csv'
                }}
                categories={categories}
                onSave={handleSaveEditedRule}
            />
        )}
    </>
  );
}