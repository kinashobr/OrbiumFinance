"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CockpitData {
  patrimonioTotal: number;
  variacaoPatrimonio: number;
  variacaoPercentual: number;
  liquidezImediata: number;
  compromissosMes: number;
  compromissosPercent: number;
  totalAtivos: number;
  projecao30Dias: number;
}

interface CockpitCardsProps {
  data: CockpitData;
}

export function CockpitCards({ data }: CockpitCardsProps) {
  const formatCompact = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toLocaleString('pt-BR');
  };

  const liquidezPercent = useMemo(() => {
    if (data.totalAtivos === 0) return 0;
    return Math.min(100, (data.liquidezImediata / data.totalAtivos) * 100);
  }, [data.liquidezImediata, data.totalAtivos]);

  const CIRCUMFERENCE = 339.29;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 h-full">
      {/* Card de Liquidez */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex items-center justify-between relative overflow-hidden h-[200px] hover:shadow-lg transition-shadow group">
        <div className="flex flex-col h-full justify-between z-10">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Liquidez</p>
            <p className="font-display font-bold text-3xl text-foreground">R$ {formatCompact(data.liquidezImediata)}</p>
            <p className="text-xs text-muted-foreground mt-1">Disponível agora</p>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              data.liquidezImediata > 0 ? "bg-primary" : "bg-neutral-300"
            )}></span>
            <span className={cn(
              "text-xs font-bold",
              data.liquidezImediata > 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {data.liquidezImediata > 0 ? "Saldo operante" : "Sem saldo"}
            </span>
          </div>
        </div>
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="transform -rotate-90 w-full h-full">
            <circle 
              className="text-neutral-100 dark:text-neutral-800" 
              cx="64" cy="64" r="54" 
              fill="transparent" 
              stroke="currentColor" 
              strokeWidth="10"
            />
            <circle 
              className="text-primary transition-all duration-1000 ease-out" 
              cx="64" cy="64" r="54" 
              fill="transparent" 
              stroke="currentColor" 
              strokeWidth="10"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE - (CIRCUMFERENCE * liquidezPercent / 100)}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-2xl font-bold text-foreground">{liquidezPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Card de Compromissos */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex items-center justify-between relative overflow-hidden h-[200px] hover:shadow-lg transition-shadow group">
        <div className="flex flex-col h-full justify-between z-10">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Compromissos</p>
            <p className="font-display font-bold text-3xl text-foreground">R$ {formatCompact(data.compromissosMes)}</p>
            <p className="text-xs text-muted-foreground mt-1">Provisionado no mês</p>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <span className={cn(
              "w-2 h-2 rounded-full",
              data.totalAtivos === 0 ? "bg-neutral-300" :
              data.compromissosPercent <= 70 ? "bg-green-400" : "bg-red-400"
            )}></span>
            <span className={cn(
              "text-xs font-bold",
              data.totalAtivos === 0 ? "text-muted-foreground" :
              data.compromissosPercent <= 70 ? "text-green-600" : "text-red-600"
            )}>
              {data.totalAtivos === 0 ? "Sem movimentação" :
               data.compromissosPercent <= 70 ? "Saúde: Estável" : "Saúde: Alerta"}
            </span>
          </div>
        </div>
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="transform -rotate-90 w-full h-full">
            <circle 
              className="text-neutral-100 dark:text-neutral-800" 
              cx="64" cy="64" r="54" 
              fill="transparent" 
              stroke="currentColor" 
              strokeWidth="10"
            />
            <circle 
              className={cn(
                "transition-all duration-1000 ease-out",
                data.totalAtivos === 0 ? "text-neutral-200" :
                data.compromissosPercent <= 70 ? "text-indigo-400" : "text-red-400"
              )}
              cx="64" cy="64" r="54" 
              fill="transparent" 
              stroke="currentColor" 
              strokeWidth="10"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, data.compromissosPercent) / 100)}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-2xl font-bold text-foreground">{data.compromissosPercent.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}