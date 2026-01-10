import { useState, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, parseDateLocal } from "@/lib/utils";

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

    if (value === 0) return "bg-muted/20";
    const intensity = value / maxValue;
    const color = viewType === "despesas" ? "destructive" : "success";
    if (intensity < 0.3) return `bg-${color}/20`;
    if (intensity < 0.6) return `bg-${color}/40`;
    return `bg-${color}/70`;
  };

  return (
    <TooltipProvider>
      <div className="glass-card p-5 space-y-4 rounded-[1.75rem] border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Intensidade de Caixa</h3>
            <p className="text-[11px] text-muted-foreground">Movimentações diárias no mês</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar-mobile">
            {[
              { id: "all", label: "Geral" },
              { id: "receitas", label: "Entradas" },
              { id: "despesas", label: "Saídas" },
              { id: "aportes", label: "Aportes" },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setViewType(opt.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                  viewType === opt.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-muted-foreground text-center opacity-60">
                {d}
              </div>
            ))}
            {calendarDays.map((day, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold border transition-transform hover:scale-105 cursor-default",
                    getIntensity(day)
                  )}>
                    {day?.day}
                  </div>
                </TooltipTrigger>
                {day && (
                  <TooltipContent>
                    <p className="font-bold text-xs">Dia {day.day}</p>
                    <div className="text-[10px] space-y-0.5 mt-1">
                      <p className="text-success">Entradas: {day.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <p className="text-destructive">Saídas: {day.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}