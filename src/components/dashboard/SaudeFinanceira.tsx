"use client";

import { 
  Wallet, 
  Scale, 
  Activity,
  Shield,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  diversificacao,
  estabilidadeFluxo,
  dependenciaRenda,
}: SaudeFinanceiraProps) {
  
  const getLiquidezStatus = (val: number) => {
    if (val >= 2) return { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20" };
    if (val >= 1.2) return { label: "BOM", color: "text-blue-800", bg: "bg-blue-50/80 dark:bg-blue-900/10", border: "border-blue-100 dark:border-blue-900/20" };
    return { label: "ATENÇÃO", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20" };
  };

  const getEndividamentoStatus = (val: number) => {
    if (val <= 25) return { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20" };
    if (val <= 45) return { label: "ALERTA", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20" };
    return { label: "ALTO", color: "text-red-800", bg: "bg-red-50/80 dark:bg-red-900/10", border: "border-red-100 dark:border-red-900/20" };
  };

  const getDiversificacaoStatus = (val: number) => {
    if (val >= 60) return { label: "ALTA", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10" };
    return { label: "BAIXA", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10" };
  };

  const liq = getLiquidezStatus(liquidez);
  const end = getEndividamentoStatus(endividamento);
  const div = getDiversificacaoStatus(diversificacao);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-display font-bold text-lg text-foreground">Saúde Financeira</h3>
          <span className="text-[10px] font-bold text-primary bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-full uppercase tracking-wide">Performance</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Liquidez */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", liq.bg, liq.border)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Wallet className={cn("w-5 h-5", liq.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", liq.bg.replace('50/80', '100').replace('900/10', '900/40'))}>
                    {liq.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", liq.color.replace('800', '600'))}>{liquidez.toFixed(1)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Liquidez Geral</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] p-3 rounded-2xl">
              <p className="text-xs">Relação entre tudo o que você possui (Ativos) e tudo o que deve (Passivos). Ideal: acima de 1.2.</p>
            </TooltipContent>
          </Tooltip>

          {/* Endividamento */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", end.bg, end.border)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Scale className={cn("w-5 h-5", end.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", end.bg.replace('50/80', '100').replace('900/10', '900/40'))}>
                    {end.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", end.color.replace('800', '600'))}>{endividamento.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Endividamento</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] p-3 rounded-2xl">
              <p className="text-xs">Percentual do seu patrimônio total que está comprometido com dívidas. Ideal: abaixo de 30%.</p>
            </TooltipContent>
          </Tooltip>

          {/* Diversificação */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", div.bg, "border-neutral-100 dark:border-neutral-800")}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Activity className={cn("w-5 h-5", div.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", div.color === 'text-green-800' ? 'text-green-800 bg-green-100/50' : 'text-orange-800 bg-orange-100/50')}>
                    {div.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", div.color.replace('800', '600'))}>{diversificacao.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Diversificação</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] p-3 rounded-2xl">
              <p className="text-xs">Mede o equilíbrio entre diferentes classes de ativos (Renda Fixa, Variável, Cripto, etc) no seu portfólio.</p>
            </TooltipContent>
          </Tooltip>

          {/* Estabilidade Fluxo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-white dark:bg-surface-dark rounded-3xl p-5 border border-neutral-100 dark:border-neutral-800 shadow-sm transition-all hover:scale-[1.02] cursor-help">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-muted-foreground">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-muted-foreground">
                    {estabilidadeFluxo >= 80 ? "ALTA" : "MÉDIA"}
                  </span>
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{estabilidadeFluxo.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Estabilidade</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] p-3 rounded-2xl">
              <p className="text-xs">Mede a consistência das suas sobras de caixa mensais ao longo do tempo.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}