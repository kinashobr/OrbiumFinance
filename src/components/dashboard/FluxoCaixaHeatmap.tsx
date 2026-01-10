import { useState, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, parseDateLocal } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Coins } from "lucide-react";

interface DayData {
  day: number;
  receitas: number;
  despesas: number;
  transferencias: number;
  aportes: number;
}

interface TransacaoV2 {
  id: string;
  date: string;
  amount: number;
  operationType: string;
  flow: string;
  [key: string]: any;
}

interface FluxoCaixaHeatmapProps {
  month: string;
  year: number;
  transacoes: TransacaoV2[];
}

export function FluxoCaixaHeatmap({ month, year, transacoes }: FluxoCaixaHeatmapProps) {
  const [viewType, setViewType] = useState<"all" | "receitas" | "despesas" | "aportes">("all");
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  
  const calendarDays: (DayData | null)[] = useMemo(() => {
    const firstDay = new Date(year, parseInt(month) - 1, 1).getDay();
    const daysInMonth = new Date(year, parseInt(month), 0).getDate();
    const result: (DayData | null)[] = Array(firstDay).fill(null);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = transacoes
        .filter(t => {
          const txDate = parseDateLocal(t.date);
          return txDate.getDate() === day && 
                 txDate.getMonth() === parseInt(month) - 1 && 
                 txDate.getFullYear() === year;
        })
        .reduce((acc, t) => {
          if (t.operationType === "receita" || t.operationType === "rendimento") acc.receitas += t.amount;
          else if (t.operationType === "despesa" || t.operationType === "pagamento_emprestimo") acc.despesas += t.amount;
          else if (t.operationType === "transferencia") acc.transferencias += t.amount;
          else if (t.operationType === "aplicacao") acc.aportes += t.amount;
          return acc;
        }, { day, receitas: 0, despesas: 0, transferencias: 0, aportes: 0 });
      result.push(dayData);
    }
    return result;
  }, [transacoes, month, year]);

  const maxValue = useMemo(() => {
    const values = calendarDays.filter((d): d is DayData => d !== null).map(d => {
      if (viewType === "receitas") return d.receitas;
      if (viewType === "despesas") return d.despesas;
      if (viewType === "aportes") return d.aportes;
      return d.receitas + d.despesas;
    });
    return Math.max(...values, 1);
  }, [calendarDays, viewType]);

  const getIntensity = (dayData: DayData | null): string => {
    if (!dayData) return "bg-transparent border-transparent";
    let value = 0;
    if (viewType === "receitas") value = dayData.receitas;
    else if (viewType === "despesas") value = dayData.despesas;
    else if (viewType === "aportes") value = dayData.aportes;
    else value = dayData.receitas + dayData.despesas;

    if (value === 0) return "bg-muted/20 text-muted-foreground/50";
    
    const intensity = value / maxValue;
    const baseColor = viewType === "despesas" ? "destructive" : "primary";
    
    if (intensity < 0.1) return `bg-muted/50 text-muted-foreground/50`;
    if (intensity < 0.3) return `bg-${baseColor}/10 text-${baseColor}/80`;
    if (intensity < 0.6) return `bg-${baseColor}/30 text-${baseColor}/90`;
    if (intensity < 0.9) return `bg-${baseColor}/60 text-white`;
    return `bg-${baseColor} text-white shadow-lg shadow-${baseColor}/30 scale-105`;
  };
  
  const getLegendColor = (type: typeof viewType) => {
    if (type === 'despesas') return 'destructive';
    return 'primary';
  };

  return (
    <TooltipProvider>
      <Card className="glass-card p-6 rounded-[var(--radius)] border-border/60 shadow-expressive">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-lg text-foreground tracking-tight">Intensidade de Caixa</h3>
            <p className="text-xs text-muted-foreground mt-1">Densidade de movimentações financeiras no período</p>
          </div>
          <div className="flex items-center gap-4 bg-muted/50 px-4 py-2 rounded-full border border-border/60">
            <span className="text-xs font-bold text-muted-foreground">Volume:</span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
              <span>Baixo</span>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded bg-muted/50"></span>
                <span className="w-3 h-3 rounded bg-primary/20"></span>
                <span className="w-3 h-3 rounded bg-primary/50"></span>
                <span className="w-3 h-3 rounded bg-primary"></span>
              </div>
              <span>Alto</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar-mobile">
            {[
              { id: "all", label: "Geral", icon: DollarSign },
              { id: "receitas", label: "Entradas", icon: TrendingUp },
              { id: "despesas", label: "Saídas", icon: TrendingDown },
              { id: "aportes", label: "Aportes", icon: Coins },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setViewType(opt.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1",
                  viewType === opt.id 
                    ? `bg-${getLegendColor(opt.id as typeof viewType)} text-white border-${getLegendColor(opt.id as typeof viewType)}` 
                    : "bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted"
                )}
              >
                <opt.icon className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center mb-2 border-b border-border/50 pb-2">
            {weekDays.map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-muted-foreground uppercase">
                {d}
              </span>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold">
            {calendarDays.map((day, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "aspect-[1.5/1] flex items-center justify-center rounded-2xl border border-transparent transition-transform hover:scale-105 cursor-default",
                    getIntensity(day)
                  )}>
                    {day?.day}
                  </div>
                </TooltipTrigger>
                {day && (
                  <TooltipContent className="bg-popover border-border rounded-xl shadow-xl">
                    <p className="font-bold text-xs">Dia {day.day}</p>
                    <div className="text-[10px] space-y-0.5 mt-1">
                      <p className="text-success">Entradas: {day.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className="text-destructive">Saídas: {day.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className="text-primary">Transferências: {day.transferencias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}