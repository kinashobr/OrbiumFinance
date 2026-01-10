"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CockpitData {
  patrimonioTotal: number;
  variacaoPatrimonio: number;
  variacaoPercentual: number;
  liquidezImediata: number;
  compromissosMes: number;
  projecao30Dias: number;
  totalAtivos: number;
}

interface CockpitCardsProps {
  data: CockpitData;
}

export function CockpitCards({ data }: CockpitCardsProps) {
  const formatCompact = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const liquidezPercent = useMemo(() => {
    if (data.totalAtivos === 0) return 0;
    return Math.min(100, (data.liquidezImediata / data.totalAtivos) * 100);
  }, [data.liquidezImediata, data.totalAtivos]);

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
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xs font-bold text-primary">Saldo operante</span>
          </div>
        </div>
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="transform -rotate-90 w-full h-full">
            <circle className="text-neutral-100 dark:text-neutral-800" cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" strokeWidth="10"></circle>
            <circle 
              className="text-primary transition-all duration-1000 ease-out" 
              cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" 
              strokeWidth="10"
              strokeDasharray="339.29"
              strokeDashoffset={339.29 - (339.29 * liquidezPercent / 100)}
              strokeLinecap="round"
            ></circle>
          </svg>
          <span className="absolute text-2xl font-bold text-foreground">{liquidezPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Card de Carteira / Distribuição */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex items-center justify-between relative overflow-hidden h-[200px] hover:shadow-lg transition-shadow group">
        <div className="flex flex-col h-full justify-between z-10">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Compromissos</p>
            <p className="font-display font-bold text-3xl text-foreground">R$ {formatCompact(data.compromissosMes)}</p>
            <p className="text-xs text-muted-foreground mt-1">Provisionado no mês</p>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-xs font-bold text-indigo-500">Saúde: Estável</span>
          </div>
        </div>
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="transform -rotate-90 w-full h-full">
            <circle className="text-neutral-100 dark:text-neutral-800" cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" strokeWidth="10"></circle>
            <circle 
              className="text-indigo-400 transition-all duration-1000 ease-out" 
              cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" 
              strokeWidth="10"
              strokeDasharray="339.29"
              strokeDashoffset={339.29 - (339.29 * 65 / 100)}
              strokeLinecap="round"
            ></circle>
          </svg>
          <span className="absolute text-2xl font-bold text-foreground">65%</span>
        </div>
      </div>
    </div>
  );
}