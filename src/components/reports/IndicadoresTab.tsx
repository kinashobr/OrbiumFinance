"use client";

import { useMemo, useCallback } from "react";
import { Droplets, Shield, TrendingUp, Gauge, Activity, ShieldCheck, Calculator, Zap, Flame, Target, Banknote, CreditCard, Sparkles } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { RadialGauge } from "./RadialGauge";
import { ComparisonDateRanges, DateRange } from "@/types/finance";
import { startOfDay, endOfDay, isWithinInterval, addMonths, isBefore, isAfter, isSameDay } from "date-fns";
import { parseDateLocal, cn } from "@/lib/utils";

export function IndicadoresTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, contasMovimento, getAtivosTotal, getPassivosTotal, getSaldoDevedor, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, calculateTotalInvestmentBalanceAtDate, categoriasV2, segurosVeiculo } = useFinance();
  const { range1, range2 } = dateRanges;

  const calculateIndicators = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date(9999, 11, 31);
    const txs = transacoesV2.filter(t => {
      try {
        const d = parseDateLocal(t.date);
        return isWithinInterval(d, { start: startOfDay(range.from || new Date(0)), end: endOfDay(range.to || new Date()) });
      } catch { return false; }
    });

    const totalAtivos = getAtivosTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    const pl = totalAtivos - totalPassivos;
    const rec = txs.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0);
    const des = txs.filter(t => t.flow === 'out').reduce((a, t) => a + t.amount, 0);
    
    // Liquidez
    const liqGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : 2.5;
    const endiv = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
    const margem = rec > 0 ? ((rec - des) / rec) * 100 : 0;
    
    return { liqGeral, endiv, margem, totalAtivos, pl };
  }, [getAtivosTotal, getPassivosTotal, transacoesV2]);

  const ind1 = useMemo(() => calculateIndicators(range1), [calculateIndicators, range1]);
  const ind2 = useMemo(() => calculateIndicators(range2), [calculateIndicators, range2]);

  return (
    <div className="space-y-12 animate-fade-in">
      {/* GRID DE MEDIDORES RADIAIS (GAUGES) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 flex flex-col items-center text-center shadow-soft">
           <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Eficiência de Caixa</h4>
           <RadialGauge value={ind1.margem} status={ind1.margem >= 20 ? "success" : "warning"} label="Margem Líquida" size={200} />
           <p className="text-xs font-bold text-muted-foreground mt-4 px-6">Sobra livre após todas as despesas operacionais.</p>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 flex flex-col items-center text-center shadow-soft">
           <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Peso da Dívida</h4>
           <RadialGauge value={ind1.endiv} max={100} status={ind1.endiv <= 30 ? "success" : "danger"} label="Endividamento" size={200} />
           <p className="text-xs font-bold text-muted-foreground mt-4 px-6">Percentual do patrimônio comprometido com terceiros.</p>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 flex flex-col items-center text-center shadow-soft">
           <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Capacidade Total</h4>
           <RadialGauge value={ind1.liqGeral} max={5} unit="x" status={ind1.liqGeral >= 1.5 ? "success" : "danger"} label="Liquidez Geral" size={200} />
           <p className="text-xs font-bold text-muted-foreground mt-4 px-6">Relação total entre Bens e Dívidas.</p>
        </div>
      </div>

      {/* GRID DE CARDS SECUNDÁRIOS */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
           <Activity className="w-5 h-5 text-primary" />
           <h3 className="font-display font-black text-xl uppercase tracking-tight">Indicadores de Desempenho</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <ReportCard title="PL / Ativos" value={`${((ind1.pl / ind1.totalAtivos) * 100).toFixed(1)}%`} status="success" icon={<Scale />} />
           <ReportCard title="Cobertura Ativos" value={`${ind1.liqGeral.toFixed(2)}x`} status="success" icon={<ShieldCheck />} />
           <ReportCard title="Margem de Segurança" value={`${ind1.margem.toFixed(1)}%`} status="success" icon={<Shield />} />
           <ReportCard title="Burn Rate" value={`${(100 - ind1.margem).toFixed(1)}%`} status="warning" icon={<Flame />} />
        </div>
      </div>
    </div>
  );
}