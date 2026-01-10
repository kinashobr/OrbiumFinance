"use client";

import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Scale, Wallet, Building2, Car, Banknote, PiggyBank, Target, ShieldCheck, ChevronRight, Shield, Bitcoin } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { cn, parseDateLocal } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS, ComparisonDateRanges, DateRange, TransacaoCompleta } from "@/types/finance";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, addMonths, isBefore, isAfter, isSameDay } from "date-fns";
import { EvolucaoPatrimonialChart } from "@/components/dashboard/EvolucaoPatrimonialChart";
import { Badge } from "@/components/ui/badge";

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, contasMovimento, emprestimos, segurosVeiculo, getAtivosTotal, getPassivosTotal, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, calculateLoanSchedule, getCreditCardDebt, getLoanPrincipalRemaining } = useFinance();

  const { range1, range2 } = dateRanges;

  const calculateBalanco = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date(9999, 11, 31);
    const saldos = contasMovimento.reduce((acc, c) => ({ ...acc, [c.id]: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento) }), {} as Record<string, number>);
    
    const totalAtivos = getAtivosTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    
    const ativosCirculantes = contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)).reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0) + getSegurosAApropriar(finalDate);
    const ativosNaoCirculantes = totalAtivos - ativosCirculantes;
    
    return {
      totalAtivos, totalPassivos, pl: totalAtivos - totalPassivos, circulantes: ativosCirculantes, naoCirculantes: ativosNaoCirculantes, saldos
    };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getAtivosTotal, getPassivosTotal, getSegurosAApropriar]);

  const b1 = useMemo(() => calculateBalanco(range1), [calculateBalanco, range1]);
  const b2 = useMemo(() => calculateBalanco(range2), [calculateBalanco, range2]);

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
  const calcVar = (v1: number, v2: number) => v2 === 0 ? 0 : ((v1 - v2) / Math.abs(v2)) * 100;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* HERO SECTION - Patrimônio Líquido */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-10 shadow-soft border border-white/60 dark:border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-700">
          <Scale className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm"><Scale className="w-6 h-6" /></div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Riqueza Líquida Consolidade</span>
            </div>
            <h2 className="text-6xl sm:text-7xl font-black tracking-tighter text-foreground tabular-nums">
              {formatCurrency(b1.pl)}
            </h2>
            <div className="flex items-center gap-3">
              <Badge className={cn("rounded-lg border-none px-3 py-1 font-black text-xs", b1.pl >= b2.pl ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                {b1.pl >= b2.pl ? "+" : ""}{calcVar(b1.pl, b2.pl).toFixed(1)}% vs anterior
              </Badge>
              <span className="text-xs font-bold text-muted-foreground">Evolução do Patrimônio Líquido</span>
            </div>
          </div>
          <div className="w-full md:w-64 h-24 opacity-40">
             {/* Simulação de Mini Trend */}
             <div className="flex items-end gap-1 h-full">
                {[40, 60, 50, 80, 70, 90, 85].map((h, i) => <div key={i} className="flex-1 bg-primary rounded-t-lg" style={{ height: `${h}%` }} />)}
             </div>
          </div>
        </div>
      </div>

      {/* Cockpit de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportCard title="Ativo Total" value={formatCurrency(b1.totalAtivos)} trend={calcVar(b1.totalAtivos, b2.totalAtivos)} status="success" icon={<TrendingUp />} />
        <ReportCard title="Ativos Circulantes" value={formatCurrency(b1.circulantes)} trend={calcVar(b1.circulantes, b2.circulantes)} status="success" icon={<Banknote />} />
        <ReportCard title="Investimentos Estáticos" value={formatCurrency(b1.naoCirculantes)} trend={calcVar(b1.naoCirculantes, b2.naoCirculantes)} status="info" icon={<PiggyBank />} />
        <ReportCard title="Passivo Total" value={formatCurrency(b1.totalPassivos)} trend={calcVar(b1.totalPassivos, b2.totalPassivos)} status={b1.totalPassivos > 0 ? "danger" : "success"} icon={<TrendingDown />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Painel Ativo */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success shadow-sm"><ShieldCheck className="w-5 h-5" /></div>
              <h3 className="font-display font-black text-xl">Composição do Ativo</h3>
            </div>
            <Badge variant="secondary" className="font-black text-[10px] uppercase bg-success/10 text-success border-none">Bens & Direitos</Badge>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Ativo Circulante</p>
               {contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)).map(c => (
                 <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:scale-[1.02] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-success/10 transition-colors"><Building2 className="w-5 h-5 text-muted-foreground group-hover:text-success" /></div>
                      <div><p className="text-sm font-bold">{c.name}</p><p className="text-[9px] font-black uppercase text-muted-foreground opacity-50">{ACCOUNT_TYPE_LABELS[c.accountType]}</p></div>
                    </div>
                    <p className="text-sm font-black tabular-nums text-success">{formatCurrency(b1.saldos[c.id] || 0)}</p>
                 </div>
               ))}
            </div>

            <div className="space-y-3">
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Ativo Não Circulante</p>
               {getValorFipeTotal(range1.to) > 0 && (
                 <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:scale-[1.02] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10"><Car className="w-5 h-5 text-muted-foreground group-hover:text-primary" /></div>
                      <div><p className="text-sm font-bold">Imobilizado (FIPE)</p><p className="text-[9px] font-black uppercase text-muted-foreground opacity-50">Veículos & Frota</p></div>
                    </div>
                    <p className="text-sm font-black tabular-nums text-primary">{formatCurrency(getValorFipeTotal(range1.to))}</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Painel Evolução */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm"><TrendingUp className="w-5 h-5" /></div>
              <h3 className="font-display font-black text-xl">Evolução Patrimonial</h3>
            </div>
            <div className="h-[340px]">
              <EvolucaoPatrimonialChart />
            </div>
        </div>
      </div>
    </div>
  );
}