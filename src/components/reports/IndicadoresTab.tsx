"use client";

import { useMemo, useCallback } from "react";
import { Activity, ShieldCheck, Zap, Scale, Sparkles, TrendingUp, TrendingDown, Target, Shield, Gauge } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ComparisonDateRanges, DateRange, formatCurrency } from "@/types/finance";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { parseDateLocal, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function IndicadoresTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, getAtivosTotal, getPassivosTotal } = useFinance();
  const { range1 } = dateRanges;

  const ind = useMemo(() => {
    const finalDate = range1.to || new Date();
    const txs = transacoesV2.filter(t => {
      try {
        const d = parseDateLocal(t.date);
        return isWithinInterval(d, { start: startOfDay(range1.from || new Date(0)), end: endOfDay(range1.to || new Date()) });
      } catch { return false; }
    });

    const totalAtivos = getAtivosTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    const pl = totalAtivos - totalPassivos;
    const rec = txs.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0);
    const des = txs.filter(t => t.flow === 'out').reduce((a, t) => a + t.amount, 0);
    
    const liqGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : 2.5;
    const endiv = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
    const margem = rec > 0 ? ((rec - des) / rec) * 100 : 0;
    
    return { liqGeral, endiv, margem, totalAtivos, pl, rec };
  }, [getAtivosTotal, getPassivosTotal, transacoesV2, range1]);

  const PremiumIndicator = ({ title, value, subtitle, icon: Icon, status, badge }: any) => (
    <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
      <div className="absolute right-0 bottom-0 opacity-5 scale-150 translate-x-12 translate-y-12 group-hover:rotate-6 transition-transform duration-1000">
        <Icon className="w-[200px] h-[200px]" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
           <div className="w-14 h-14 rounded-[1.25rem] bg-white/10 backdrop-blur-md flex items-center justify-center text-primary shadow-lg border border-white/10 group-hover:scale-110 transition-transform">
              <Icon className="w-7 h-7" />
           </div>
           <Badge className={cn(
             "rounded-xl px-4 py-1.5 font-black text-[10px] uppercase tracking-widest border-none",
             status === 'success' ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
           )}>
             {badge}
           </Badge>
        </div>
        
        <div className="space-y-2">
           <h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">{title}</h4>
           <p className="text-5xl font-black tracking-tighter tabular-nums text-white leading-none">
             {value}
           </p>
           <p className="text-sm font-bold text-neutral-500 mt-4 max-w-[180px] leading-relaxed">
             {subtitle}
           </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 animate-fade-in-up">
      <div className="flex items-center gap-4 px-2">
        <div className="p-3 bg-accent/10 rounded-2xl text-accent">
           <Gauge className="w-6 h-6" />
        </div>
        <div>
           <h3 className="font-display font-black text-2xl uppercase tracking-tight">Saúde Estrutural</h3>
           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Indicadores Orbium Premium</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <PremiumIndicator 
          title="Margem de Segurança"
          value={`${ind.margem.toFixed(1)}%`}
          subtitle="Capacidade de absorção de gastos inesperados sobre sua receita."
          icon={ShieldCheck}
          status={ind.margem >= 20 ? 'success' : 'warning'}
          badge={ind.margem >= 20 ? "NÍVEL ÓTIMO" : "NÍVEL ALERTA"}
        />
        
        <PremiumIndicator 
          title="Endividamento Geral"
          value={`${ind.endiv.toFixed(0)}%`}
          subtitle="Proporção do seu patrimônio total que está em posse de terceiros."
          icon={Activity}
          status={ind.endiv <= 30 ? 'success' : 'warning'}
          badge={ind.endiv <= 30 ? "EQUILIBRADO" : "ELEVADO"}
        />

        <PremiumIndicator 
          title="Liquidez Estrutural"
          value={`${ind.liqGeral.toFixed(2)}x`}
          subtitle="Quantas vezes seus ativos cobrem suas dívidas totais."
          icon={Scale}
          status={ind.liqGeral >= 2 ? 'success' : 'warning'}
          badge={ind.liqGeral >= 2 ? "PREMIUM" : "PADRÃO"}
        />
      </div>

      {/* FOOTER INSIGHTS */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-10 border border-white/60 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 group">
         <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent animate-pulse shadow-inner">
               <Sparkles className="w-10 h-10" />
            </div>
            <div className="max-w-md">
               <h4 className="font-display font-black text-xl mb-2">Diagnóstico de Crescimento</h4>
               <p className="text-sm text-muted-foreground leading-relaxed">
                  Baseado em seu Balanço e DRE, seu patrimônio está crescendo a uma taxa saudável. Recomendamos manter a margem acima de 20% para acelerar a independência financeira.
               </p>
            </div>
         </div>
         <Button className="rounded-full px-10 h-14 font-black shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
           OTIMIZAR CARTEIRA
         </Button>
      </div>
    </div>
  );
}