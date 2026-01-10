"use client";

import { 
  Wallet, 
  Scale, 
  Activity,
  Shield,
  ArrowUpRight,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SaudeFinanceiraProps {
  liquidez: number;
  endividamento: number;
  diversificacao: number;
  estabilidadeFluxo: number;
  dependenciaRenda: number;
}

export function SaudeFinanceira({
  liquidez,
  endividamento,
}: SaudeFinanceiraProps) {
  
  const getLiquidezStatus = (val: number) => val >= 2 ? { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20" } : { label: "ATENÇÃO", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20" };
  const getEndividamentoStatus = (val: number) => val <= 25 ? { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20" } : { label: "ALTO", color: "text-red-800", bg: "bg-red-50/80 dark:bg-red-900/10", border: "border-red-100 dark:border-red-900/20" };

  const liq = getLiquidezStatus(liquidez);
  const end = getEndividamentoStatus(endividamento);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="font-display font-bold text-lg text-foreground">Saúde Financeira</h3>
        <span className="text-[10px] font-bold text-primary bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-full uppercase tracking-wide">Performance</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Liquidez */}
        <div className={cn("rounded-3xl p-5 border transition-colors group relative overflow-hidden", liq.bg, liq.border)}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
              <Wallet className={cn("w-5 h-5", liq.color)} />
            </div>
            <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full border border-black/5 dark:border-white/5", liq.color === 'text-green-800' ? 'bg-white/60 text-green-800' : 'bg-white/60 text-orange-800')}>
              {liq.label}
            </span>
          </div>
          <p className={cn("text-3xl font-display font-bold", liq.color.replace('800', '600').replace('text-', 'text-'))}>{liquidez.toFixed(1)}</p>
          <p className="text-xs font-semibold opacity-60 mt-1">Liquidez Geral</p>
        </div>

        {/* Endividamento */}
        <div className={cn("rounded-3xl p-5 border transition-colors group relative overflow-hidden", end.bg, end.border)}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
              <Scale className={cn("w-5 h-5", end.color)} />
            </div>
            <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full border border-black/5 dark:border-white/5", end.color === 'text-green-800' ? 'bg-white/60 text-green-800' : 'bg-white/60 text-red-800')}>
              {end.label}
            </span>
          </div>
          <p className={cn("text-3xl font-display font-bold", end.color.replace('800', '600').replace('text-', 'text-'))}>{endividamento.toFixed(0)}%</p>
          <p className="text-xs font-semibold opacity-60 mt-1">Endividamento</p>
        </div>

        {/* Estabilidade (Mocked logic from original layout) */}
        <div className="bg-red-50/80 dark:bg-red-900/10 rounded-3xl p-5 border border-red-100 dark:border-red-900/20">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-red-700" />
            </div>
            <span className="text-[10px] font-bold bg-white/60 px-2 py-0.5 rounded-full text-red-800">BAIXA</span>
          </div>
          <p className="text-3xl font-display font-bold text-red-700 dark:text-red-400">Alerta</p>
          <p className="text-xs font-semibold text-red-700/60 dark:text-red-500/60 mt-1">Estabilidade Fluxo</p>
        </div>

        {/* Cobertura */}
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-5 border border-neutral-surface-light dark:border-neutral-surface-dark shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-muted-foreground">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-muted-foreground">BOM</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">6 <span className="text-sm">Meses</span></p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">Cobertura</p>
        </div>
      </div>
    </div>
  );
}