"use client";

import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calculator, Minus, Plus, Equal, Sparkles, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { cn, parseDateLocal } from "@/lib/utils";
import { ComparisonDateRanges, DateRange, TransacaoCompleta } from "@/types/finance";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function DRETab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, categoriasV2, calculateLoanSchedule } = useFinance();
  const { range1, range2 } = dateRanges;

  const calculateDRE = useCallback((range: DateRange) => {
    const rangeFrom = range.from ? startOfDay(range.from) : undefined;
    const rangeTo = range.to ? endOfDay(range.to) : undefined;
    
    const txs = transacoesV2.filter(t => {
      try {
        const d = parseDateLocal(t.date);
        return (!rangeFrom || isWithinInterval(d, { start: rangeFrom, end: rangeTo || new Date() }));
      } catch { return false; }
    });

    const rec = txs.filter(t => t.operationType === 'receita').reduce((a, t) => a + t.amount, 0);
    const fix = txs.filter(t => {
      const c = categoriasV2.find(x => x.id === t.categoryId);
      return c?.nature === 'despesa_fixa';
    }).reduce((a, t) => a + t.amount, 0);
    const var_ = txs.filter(t => {
      const c = categoriasV2.find(x => x.id === t.categoryId);
      return c?.nature === 'despesa_variavel';
    }).reduce((a, t) => a + t.amount, 0);
    
    let juros = 0;
    txs.filter(t => t.operationType === 'pagamento_emprestimo').forEach(t => {
      const lid = t.links?.loanId?.replace('loan_', '');
      const pid = t.links?.parcelaId;
      if (lid && pid) {
        const s = calculateLoanSchedule(parseInt(lid));
        const item = s.find(i => i.parcela === parseInt(pid));
        if (item) juros += item.juros;
      }
    });

    const res = rec - fix - var_ - juros;
    return { rec, fix, var: var_, juros, res };
  }, [transacoesV2, categoriasV2, calculateLoanSchedule]);

  const dre1 = useMemo(() => calculateDRE(range1), [calculateDRE, range1]);
  const dre2 = useMemo(() => calculateDRE(range2), [calculateDRE, range2]);

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-12 animate-fade-in">
      {/* HERO SECTION - Resultado Líquido */}
      <div className={cn(
        "rounded-[3.5rem] p-12 shadow-soft border-4 transition-all duration-700 relative overflow-hidden flex flex-col items-center text-center group",
        dre1.res >= 0 ? "bg-success/5 border-success/20 shadow-success/10" : "bg-destructive/5 border-destructive/20 shadow-destructive/10"
      )}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/[0.02]" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-center gap-3">
             <div className={cn("p-3 rounded-2xl shadow-xl", dre1.res >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground")}>
                <DollarSign className="w-8 h-8" />
             </div>
             <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60">Performance Mensal</p>
                <h3 className="font-display font-black text-2xl uppercase">{dre1.res >= 0 ? "Superávit Líquido" : "Déficit Líquido"}</h3>
             </div>
          </div>
          
          <h2 className={cn("text-7xl sm:text-8xl font-black tracking-tighter tabular-nums leading-none", dre1.res >= 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(dre1.res)}
          </h2>

          <div className="flex items-center justify-center gap-4">
             <Badge className={cn("rounded-xl px-4 py-1.5 font-black text-sm", dre1.res >= dre2.res ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                {dre1.res >= dre2.res ? <ArrowUpRight className="w-4 h-4 mr-2" /> : <ArrowDownRight className="w-4 h-4 mr-2" />}
                {formatCurrency(Math.abs(dre1.res - dre2.res))} de variação
             </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
         {/* Estrutura DRE como Fluxo Cascata */}
         <div className="space-y-4">
            <div className="p-6 rounded-[2rem] bg-success/10 border border-success/20 flex items-center justify-between group hover:scale-[1.01] transition-transform">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-success text-white flex items-center justify-center shadow-lg"><Plus className="w-6 h-6" /></div>
                  <div><p className="text-sm font-black uppercase tracking-widest text-success/60">Receita Bruta</p><p className="text-2xl font-black text-foreground">Entradas do Período</p></div>
               </div>
               <p className="text-3xl font-black text-success tabular-nums">{formatCurrency(dre1.rec)}</p>
            </div>

            <div className="flex justify-center py-2 opacity-30"><Minus className="w-8 h-8" /></div>

            <div className="p-6 rounded-[2rem] bg-destructive/5 border border-destructive/10 flex items-center justify-between group hover:scale-[1.01] transition-transform">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-destructive text-white flex items-center justify-center shadow-lg"><Minus className="w-6 h-6" /></div>
                  <div><p className="text-sm font-black uppercase tracking-widest text-destructive/60">Gastos Operacionais</p><p className="text-2xl font-black text-foreground">Fixas + Variáveis</p></div>
               </div>
               <p className="text-3xl font-black text-destructive tabular-nums">{formatCurrency(dre1.fix + dre1.var)}</p>
            </div>

            <div className="flex justify-center py-2 opacity-30"><Calculator className="w-8 h-8" /></div>

            <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-center justify-between group hover:scale-[1.01] transition-transform">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg"><TrendingDown className="w-6 h-6" /></div>
                  <div><p className="text-sm font-black uppercase tracking-widest text-primary/60">Custo Financeiro</p><p className="text-2xl font-black text-foreground">Juros de Crédito</p></div>
               </div>
               <p className="text-3xl font-black text-primary tabular-nums">{formatCurrency(dre1.juros)}</p>
            </div>
         </div>
      </div>
    </div>
  );
}