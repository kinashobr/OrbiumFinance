import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Trash2, Pencil, Search, Sparkles, X, Plus } from "lucide-react";
import { StandardizationRule, Categoria, OPERATION_TYPE_LABELS } from "@/types/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { useFinance } from "@/contexts/FinanceContext";
import { Badge } from "@/components/ui/badge";

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
  const { addStandardizationRule, updateStandardizationRule } = useFinance();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRule, setEditingRule] = useState<StandardizationRule | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const filteredRules = useMemo(() => {
    return rules.filter(r => 
      r.pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descriptionTemplate.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rules, searchTerm]);

  const handleDelete = (rule: StandardizationRule) => {
    if (window.confirm(`Excluir regra para "${rule.pattern}"?`)) {
      onDeleteRule(rule.id);
      toast.success("Regra removida.");
    }
  };

  const handleEdit = (rule: StandardizationRule) => {
    setEditingRule(rule);
    setShowFormModal(true);
  };

  const handleSaveRule = (data: Omit<StandardizationRule, "id">, ruleId?: string) => {
    if (ruleId) {
      updateStandardizationRule(ruleId, data);
      toast.success("Regra atualizada!");
    } else {
      addStandardizationRule(data);
      toast.success("Regra criada!");
    }
    setEditingRule(null);
  };

  const handleAddNew = () => {
    setEditingRule(null);
    setShowFormModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[min(95vw,56rem)] h-[min(90vh,800px)] p-0 overflow-hidden rounded-[2.5rem]">
          <DialogHeader className="px-8 pt-8 pb-6 bg-surface-light dark:bg-surface-dark shrink-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                  <Pin className="w-7 h-7" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">Regras de Padronização</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    Automação inteligente de extratos
                  </DialogDescription>
                </div>
              </div>
              <Button onClick={handleAddNew} className="rounded-full gap-2 px-6 font-bold shadow-lg shadow-primary/10">
                <Plus className="w-4 h-4" /> Nova Regra
              </Button>
            </div>

            <div className="relative group px-8">
              <Search className="absolute left-12 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por padrão ou descrição final..."
                className="w-full h-12 pl-12 pr-4 bg-muted/50 border-2 border-transparent focus:border-primary/30 rounded-2xl text-sm font-medium transition-all outline-none"
              />
            </div>

          </DialogHeader>

          <ScrollArea className="flex-1 px-8 pb-8">
            <div className="space-y-3">
              {filteredRules.map((rule) => {
                const category = rule.categoryId ? categoriesMap.get(rule.categoryId) : null;
                const operationConfig = STANDARDIZABLE_OPERATIONS.find(op => op.value === rule.operationType);
                
                return (
                  <div 
                    key={rule.id} 
                    className="p-4 rounded-3xl bg-card border border-border/40 hover:border-primary/30 hover:shadow-md transition-all group flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider py-0 px-2 rounded-lg", operationConfig?.color.replace('text-', 'bg-') + '/10', operationConfig?.color)}>
                          {operationConfig?.label || 'N/A'}
                        </Badge>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">
                          Padrão: "{rule.pattern}"
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-base text-foreground truncate">{rule.descriptionTemplate}</p>
                        {category && (
                          <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            {category.icon} {category.label}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleEdit(rule)}
                      >
                        <Pencil className="w-4.5 h-4.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(rule)}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {filteredRules.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center opacity-30">
                  <Search className="w-12 h-12 mb-4" />
                  <p className="font-bold uppercase tracking-widest text-xs">Nenhuma regra encontrada</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-muted/10 border-t shrink-0">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full px-6 font-bold gap-2">
                <X className="w-4 h-4" /> Fechar
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StandardizationRuleFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        initialRule={editingRule}
        categories={categories}
        onSave={handleSaveRule}
      />
    </>
  );
}