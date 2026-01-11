"use client";

import { useMemo, useCallback } from "react";
import { 
  TrendingUp, TrendingDown, Scale, Wallet, Building2, Car, 
  Banknote, PiggyBank, Target, ShieldCheck, Shield, Bitcoin, 
  Activity, History, CreditCard, ArrowUpRight, ArrowDownRight,
  Zap, PieChart
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { cn } from "@/lib/utils";
import { 
  ACCOUNT_TYPE_LABELS, 
  ComparisonDateRanges, 
  DateRange, 
  formatCurrency 
} from "@/types/finance";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { 
    transacoesV2, 
    contasMovimento, 
    calculateBalanceUpToDate, 
    getValorFipeTotal, 
    getSegurosAApropriar, 
    getSegurosAPagar, 
    calculateLoanPrincipalDueInNextMonths, 
    getLoanPrincipalRemaining,
    getCreditCardDebt
  } = useFinance();

  const { range1 } = dateRanges;

  const b1 = useMemo(() => {
    const finalDate = range1.to || new Date();
    const saldos = contasMovimento.reduce((acc, c) => ({ 
      ...acc, 
      [c.id]: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento) 
    }), {} as Record<string, number>);
    
    const contasLiquidez = contasMovimento.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa', 'cripto', 'objetivo'].includes(c.accountType)
    );
    
    const totalLiquidez = contasLiquidez.reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0);
    const segurosAApropriar = getSegurosAApropriar(finalDate);
    const imobilizadoFipe = getValorFipeTotal(finalDate);
    
    const totalAtivos = totalLiquidez + segurosAApropriar + imobilizadoFipe;

    const dividaCartoes = getCreditCardDebt(finalDate);
    const principalEmprestimos12m = calculateLoanPrincipalDueInNextMonths(finalDate, 12);
    const segurosAPagar = getSegurosAPagar(finalDate);
    const passivosCirculantes = dividaCartoes + principalEmprestimos12m + segurosAPagar;
    
    const saldoDevedorTotalEmprestimos = getLoanPrincipalRemaining(finalDate);
    const passivosNaoCirculantes = Math.max(0, saldoDevedorTotalEmprestimos - principalEmprestimos12m);
    
    const totalPassivos = passivosCirculantes + passivosNaoCirculantes;

    return {
      totalAtivos,
      totalLiquidez,
      segurosAApropriar,
      imobilizadoFipe,
      totalPassivos,
      dividaCartoes,
      principalEmprestimos12m,
      segurosAPagar,
      passivosNaoCirculantes,
      pl: totalAtivos - totalPassivos,
      contas: contasLiquidez.map(c => ({ 
        ...c, 
        saldo: saldos[c.id] || 0,
        percent: totalAtivos > 0 ? ((saldos[c.id] || 0) / totalAtivos) * 100 : 0
      }))
    };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining, getCreditCardDebt, range1.to]);

  const ItemCard = ({ title, value, subtitle, icon: Icon, colorClass, percent }: any) => (
    <div className="bg-card rounded-[2rem] p-6 border border-border/40 hover:shadow-lg transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", colorClass.bg, colorClass.text)}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{subtitle}</p>
          <p className="text-lg font-black tabular-nums">{formatCurrency(value)}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
           <span>{title}</span>
           <span>{percent.toFixed(1)}%</span>
        </div>
        <Progress value={percent} className="h-1.5 rounded-full" />
      </div>
    </div>
  );

  return (
    <div className="space-y-12 animate-fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* COLUNA ATIVOS */}
        <div className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-success/10 rounded-2xl text-success shadow-sm">
                    <TrendingUp className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-display font-black text-2xl uppercase tracking-tight">Ativo Total</h3>
                    <p className="text-[10px] font-bold text-success/60 uppercase tracking-widest">Recursos Disponíveis</p>
                 </div>
              </div>
              <p className="text-3xl font-black text-success tracking-tighter tabular-nums">{formatCurrency(b1.totalAtivos)}</p>
           </div>

           <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-success/10 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                 {b1.contas.filter(c => c.saldo > 0).map(c => (
                   <ItemCard 
                    key={c.id}
                    title={c.name}
                    value={c.saldo}
                    subtitle={ACCOUNT_TYPE_LABELS[c.accountType]}
                    icon={Building2}
                    colorClass={{ bg: 'bg-green-100/50 dark:bg-green-900/20', text: 'text-success' }}
                    percent={c.percent}
                   />
                 ))}
                 
                 {b1.imobilizadoFipe > 0 && (
                   <ItemCard 
                    title="Imobilizado"
                    value={b1.imobilizadoFipe}
                    subtitle="Avaliação FIPE"
                    icon={Car}
                    colorClass={{ bg: 'bg-primary/10', text: 'text-primary' }}
                    percent={(b1.imobilizadoFipe / b1.totalAtivos) * 100}
                   />
                 )}

                 {b1.segurosAApropriar > 0 && (
                   <ItemCard 
                    title="Seguros (Prêmio)"
                    value={b1.segurosAApropriar}
                    subtitle="Ativo Diferido"
                    icon={Shield}
                    colorClass={{ bg: 'bg-indigo-100/50 dark:bg-indigo-900/20', text: 'text-indigo-600' }}
                    percent={(b1.segurosAApropriar / b1.totalAtivos) * 100}
                   />
                 )}
              </div>
           </div>
        </div>

        {/* COLUNA PASSIVOS */}
        <div className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-destructive/10 rounded-2xl text-destructive shadow-sm">
                    <TrendingDown className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-display font-black text-2xl uppercase tracking-tight">Passivo Total</h3>
                    <p className="text-[10px] font-bold text-destructive/60 uppercase tracking-widest">Obrigações e Dívidas</p>
                 </div>
              </div>
              <p className="text-3xl font-black text-destructive tracking-tighter tabular-nums">{formatCurrency(b1.totalPassivos)}</p>
           </div>

           <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-destructive/10 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                 {b1.dividaCartoes > 0 && (
                   <ItemCard 
                    title="Cartões de Crédito"
                    value={b1.dividaCartoes}
                    subtitle="Passivo Circulante"
                    icon={CreditCard}
                    colorClass={{ bg: 'bg-red-100/50 dark:bg-red-900/20', text: 'text-destructive' }}
                    percent={(b1.dividaCartoes / b1.totalAtivos) * 100}
                   />
                 )}
                 
                 {b1.principalEmprestimos12m > 0 && (
                   <ItemCard 
                    title="Empréstimos (12m)"
                    value={b1.principalEmprestimos12m}
                    subtitle="Curto Prazo"
                    icon={Banknote}
                    colorClass={{ bg: 'bg-orange-100/50 dark:bg-orange-900/20', text: 'text-orange-600' }}
                    percent={(b1.principalEmprestimos12m / b1.totalAtivos) * 100}
                   />
                 )}

                 {b1.passivosNaoCirculantes > 0 && (
                   <ItemCard 
                    title="Longa Prazo"
                    value={b1.passivosNaoCirculantes}
                    subtitle="Mais de 12 meses"
                    icon={History}
                    colorClass={{ bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-muted-foreground' }}
                    percent={(b1.passivosNaoCirculantes / b1.totalAtivos) * 100}
                   />
                 )}
              </div>

              {/* Patrimônio Líquido Highlight */}
              <div className="pt-4 mt-8 border-t border-border/40">
                 <div className="bg-gradient-to-r from-primary to-primary-dark rounded-[2rem] p-8 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 opacity-10 scale-125 translate-x-4 translate-y-4 group-hover:rotate-12 transition-transform duration-700">
                       <Scale className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">Patrimônio Líquido Consolidado</p>
                       <p className="text-4xl font-black tabular-nums">{formatCurrency(b1.pl)}</p>
                       <div className="flex items-center gap-2 mt-4">
                          <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 py-1 rounded-lg">
                             {(b1.pl / b1.totalAtivos * 100).toFixed(1)}% DO ATIVO
                          </Badge>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}