"use client";

import { useMemo } from "react";
import { Activity, ShieldCheck, Zap, Scale, Sparkles, TrendingUp, TrendingDown, Target, Shield, Gauge, Heart } from "lucide-react";
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
    const rec = txs.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0);
    const des = txs.filter(t => t.flow === 'out').reduce((a, t) => a + t.amount, 0);
    const liqGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : 2.5;
    const endiv = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
    const margem = rec > 0 ? ((rec - des) / rec) * 100 : 0;
    
    let score = 0;
    if (liqGeral >= 2) score += 350; else if (liqGeral >= 1.2) score += 200;
    if (endiv <= 30) score += 350; else if (endiv <= 50) score += 150;
    if (margem >= 20) score += 300; else if (margem >= 10) score += 150;

    return { liqGeral, endiv, margem, score };
  }, [getAtivosTotal, getPassivosTotal, transacoesV2, range1]);

  const PremiumCard = ({ title, value, subtitle, icon: Icon, status, badge }: any) => (
    <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
      <div className="absolute right-0 bottom-0 opacity-5 scale-150 translate-x-12 translate-y-12 group-hover:rotate-6 transition-transform duration-1000"><Icon className="w-[200px] h-[200px]" /></div>
      <div className="relative z-10 space-y-8">
        <div className="flex items-center justify-between"><div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary border border-white/10 shadow-lg"><Icon className="w-7 h-7" /></div><Badge className={cn("rounded-xl px-4 py-1.5 font-black text-[10px] uppercase tracking-widest border-none", status === 'success' ? "bg-success text-white" : "bg-warning text-white")}>{badge}</Badge></div>
        <div className="space-y-2"><h4 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">{title}</h4><p className="text-6xl font-black tracking-tighter tabular-nums text-white leading-none">{value}</p><p className="text-sm font-bold text-neutral-500 mt-4 max-w-[200px] leading-relaxed">{subtitle}</p></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 animate-fade-in-up">
      <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 text-white rounded-[40px] p-12 shadow-lg relative overflow-hidden flex items-center justify-between group h-[320px]">
        <div className="absolute right-0 bottom-0 opacity-10 scale-150 translate-x-12 translate-y-12 group-hover:rotate-6 transition-transform duration-700"><Activity className="w-[300px] h-[300px]" /></div>
        <div className="z-10 max-w-xl">
           <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-white/10 rounded-2xl text-primary border border-white/10"><Heart className="w-8 h-8" /></div><div><h3 className="font-display font-black text-3xl mb-1">Índice de Saúde Orbium</h3><p className="text-neutral-400 text-sm font-bold uppercase tracking-widest">Algoritmo de Estabilidade Premium</p></div></div>
           <p className="text-neutral-300 text-base font-medium leading-relaxed">Sua pontuação de saúde financeira baseada em liquidez, solvência e eficiência operacional.</p>
        </div>
        <div className="z-10 flex flex-col items-center">
           <div className="w-40 h-40 rounded-full border-8 border-white/5 flex items-center justify-center bg-white/5 backdrop-blur-xl relative">
              <span className="font-display font-black text-5xl tabular-nums">{ind.score}</span>
              <svg className="absolute inset-0 w-full h-full -rotate-90"><circle cx="80" cy="80" r="74" fill="transparent" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray="465" strokeDashoffset={465 - (465 * ind.score / 1000)} strokeLinecap="round" className="transition-all duration-1000 ease-out" /></svg>
           </div>
           <Badge className="mt-4 bg-primary text-white font-black text-xs px-4 py-1 rounded-full uppercase">Status {ind.score >= 800 ? 'Premium' : 'Estável'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <PremiumCard title="Margem Livre" value={`${ind.margem.toFixed(0)}%`} subtitle="Sua capacidade de poupança sobre a receita bruta mensal." icon={ShieldCheck} status={ind.margem >= 20 ? 'success' : 'warning'} badge={ind.margem >= 20 ? "ÓTIMO" : "ALERTA"} />
        <PremiumCard title="Endividamento" value={`${ind.endiv.toFixed(0)}%`} subtitle="O peso dos seus passivos em relação ao ativo total." icon={Scale} status={ind.endiv <= 30 ? 'success' : 'warning'} badge={ind.endiv <= 30 ? "EQUILIBRADO" : "ELEVADO"} />
        <PremiumCard title="Liquidez Geral" value={`${ind.liqGeral.toFixed(2)}x`} subtitle="Sua cobertura patrimonial total contra todas as dívidas." icon={Shield} status={ind.liqGeral >= 2 ? 'success' : 'warning'} badge={ind.liqGeral >= 2 ? "PREMIUM" : "PADRÃO"} />
      </div>
    </div>
  );
}