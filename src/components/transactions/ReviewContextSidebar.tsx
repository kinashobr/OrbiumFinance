import { useMemo, useCallback } from "react";
import { Calendar, FileText, Check, Clock, Pin, RefreshCw, X, Save, Sparkles, AlertCircle, Info, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PeriodSelector } from "../dashboard/PeriodSelector";
import { DateRange, ComparisonDateRanges, ImportedStatement, formatCurrency } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area"; 

interface ReviewContextSidebarProps {
  accountId: string;
  statements: ImportedStatement[];
  pendingCount: number;
  readyToContabilizeCount: number; 
  totalCount: number;
  reviewRange: DateRange;
  onPeriodChange: (ranges: ComparisonDateRanges) => void;
  onApplyFilter: () => void;
  onContabilize: () => void;
  onClose: () => void;
  onManageRules: () => void;
}

export function ReviewContextSidebar({
  accountId,
  statements,
  pendingCount,
  readyToContabilizeCount, 
  totalCount,
  reviewRange,
  onPeriodChange,
  onApplyFilter,
  onContabilize,
  onClose,
  onManageRules,
}: ReviewContextSidebarProps) {
  
  const isRangeSelected = !!reviewRange.from && !!reviewRange.to;
  const isReadyToContabilize = readyToContabilizeCount > 0; 
  
  const dummyRanges: ComparisonDateRanges = useMemo(() => ({
    range1: reviewRange,
    range2: { from: undefined, to: undefined }
  }), [reviewRange]);

  const totalStatements = statements.length;
  const completeStatements = statements.filter(s => s.status === 'complete').length;

  return (
    <div className="flex flex-col h-full p-6">
      
      {/* Status de Revisão Expressivo */}
      <div className="space-y-4 mb-8">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Análise Pendente</Label>
          <Card className={cn(
            "p-5 rounded-[2rem] border-none shadow-xl transition-all duration-500",
            pendingCount > 0 
                ? "bg-gradient-to-br from-orange-500 to-primary text-white shadow-primary/20" 
                : "bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-500/20"
          )}>
            <div className="flex items-center justify-between opacity-80">
              <span className="text-[10px] font-bold uppercase tracking-wider">Ações Necessárias</span>
              <FileText className="w-4 h-4" />
            </div>
            <div className="mt-3 flex items-end justify-between">
                <div>
                    <p className="text-4xl font-black tabular-nums">{pendingCount}</p>
                    <p className="text-[11px] font-bold mt-1 opacity-70">DE {totalCount} LANÇAMENTOS</p>
                </div>
                {pendingCount === 0 && <Sparkles className="w-8 h-8 opacity-40 animate-pulse" />}
            </div>
          </Card>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2 no-scrollbar">
        <div className="space-y-8">
          
          {/* Filtro de Período Expressivo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-primary" />
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Período Fiscal</Label>
            </div>
            <div className="space-y-3">
                <PeriodSelector 
                  initialRanges={dummyRanges}
                  onDateRangeChange={onPeriodChange}
                  className="w-full h-12 rounded-2xl bg-muted/50 border-border/40"
                />
                <Button 
                  onClick={onApplyFilter} 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-10 gap-2 rounded-2xl font-bold uppercase text-[10px] tracking-widest border-border/60 hover:bg-muted"
                  disabled={!isRangeSelected}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Filtrar Dados
                </Button>
            </div>
          </div>
          
          <Separator className="opacity-40" />

          {/* Inteligência Expressiva */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-accent" />
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Automação</Label>
            </div>
            <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10 space-y-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    O Orbium aplica regras de padronização assim que você carrega o arquivo.
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-10 gap-2 rounded-xl font-bold text-accent hover:bg-accent/10 transition-colors"
                  onClick={onManageRules}
                >
                  <Settings2 className="w-4 h-4" />
                  Gerenciar Regras
                </Button>
            </div>
          </div>

          {/* Status dos Arquivos */}
          <div className="space-y-3 px-1">
                <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground/60 uppercase">
                    <span>Extratos Lidos</span>
                    <span>{totalStatements}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground/60 uppercase">
                    <span>Conciliados</span>
                    <span className="text-success">{completeStatements}</span>
                </div>
          </div>

        </div>
      </ScrollArea>

      {/* Footer Fixo Expressivo */}
      <div className="mt-auto pt-6 shrink-0 space-y-3">
        <Button 
          onClick={onContabilize} 
          disabled={!isReadyToContabilize}
          className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-3"
        >
          <Check className="w-6 h-6" />
          CONTABILIZAR ({readyToContabilizeCount})
        </Button>
        <Button 
          variant="ghost" 
          onClick={onClose} 
          className="w-full h-10 rounded-xl font-bold text-muted-foreground hover:bg-muted/50"
        >
          Pausar Revisão
        </Button>
      </div>
    </div>
  );
}