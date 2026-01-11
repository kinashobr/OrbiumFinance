"use client";

import { useMemo, useCallback } from "react";
import { 
  TrendingUp, TrendingDown, Scale, Wallet, Building2, Car, 
  Banknote, PiggyBank, Target, ShieldCheck, Shield, Bitcoin, 
  Activity, FileText, ArrowRight, History 
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { cn, parseDateLocal } from "@/lib/utils";
import { 
  ACCOUNT_TYPE_LABELS, 
  ComparisonDateRanges, 
  DateRange, 
  formatCurrency 
} from "@/types/finance";
import { 
  format, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  addMonths, 
  isBefore, 
  isAfter, 
  isSameDay 
} from "date-fns";
import { EvolucaoPatrimonialChart } from "@/components/dashboard/EvolucaoPatrimonialChart";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useChartColors } from "@/hooks/useChartColors";

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { 
    transacoesV2, 
    contasMovimento, 
    emprestimos, 
    getAtivosTotal, 
    getPassivosTotal, 
    calculateBalanceUpToDate, 
    getValorFipeTotal, 
    getSegurosAApropriar, 
    getSegurosAPagar, 
    calculateLoanPrincipalDueInNextMonths, 
    getLoanPrincipalRemaining,
    getCreditCardDebt
  } = useFinance();

  const colors = useChartColors();
  const { range1, range2 } = dateRanges;

  const calculateBalancoDetailed = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date();
    
    // 1. SALDOS DAS CONTAS
    const saldos = contasMovimento.reduce((acc, c) => ({ 
      ...acc, 
      [c.id]: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento) 
    }), {} as Record<string, number>);
    
    // 2. ATIVOS
    const contasLiquidez = contasMovimento.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa', 'cripto', 'objetivo'].includes(c.accountType)
    );
    
    const totalLiquidez = contasLiquidez.reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0);
    const segurosAApropriar = getSegurosAApropriar(finalDate);
    const ativosCirculantes = totalLiquidez + segurosAApropriar;
    
    const imobilizadoFipe = getValorFipeTotal(finalDate);
    const ativosNaoCirculantes = imobilizadoFipe; // Pode incluir outros investimentos LP se houver
    
    const totalAtivos = ativosCirculantes + ativosNaoCirculantes;

    // 3. PASSIVOS
    const dividaCartoes = getCreditCardDebt(finalDate);
    const principalEmprestimos12m = calculateLoanPrincipalDueInNextMonths(finalDate, 12);
    const segurosAPagar = getSegurosAPagar(finalDate);
    
    const passivosCirculantes = dividaCartoes + principalEmprestimos12m + segurosAPagar;
    
    const saldoDevedorTotalEmprestimos = getLoanPrincipalRemaining(finalDate);
    const passivosNaoCirculantes = Math.max(0, saldoDevedorTotalEmprestimos - principalEmprestimos12m);
    
    const totalPassivos = passivosCirculantes + passivosNaoCirculantes;

    // 4. PATRIMÔNIO LÍQUIDO
    const pl = totalAtivos - totalPassivos;

    return {
      totalAtivos,
      ativosCirculantes,
      ativosNaoCirculantes,
      totalLiquidez,
      segurosAApropriar,
      imobilizadoFipe,
      totalPassivos,
      passivosCirculantes,
      passivosNaoCirculantes,
      dividaCartoes,
      principalEmprestimos12m,
      segurosAPagar,
      pl,
      contasLiquidez: contasLiquidez.map(c => ({ 
        ...c, 
        saldo: saldos[c.id] || 0,
        percent: totalAtivos > 0 ? ((saldos[c.id] || 0) / totalAtivos) * 100 : 0
      }))
    };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining, getCreditCardDebt]);

  const b1 = useMemo(() => calculateBalancoDetailed(range1), [calculateBalancoDetailed, range1]);
  const b2 = useMemo(() => calculateBalancoDetailed(range2), [calculateBalancoDetailed, range2]);

  const calcVar = (v1: number, v2: number) => v2 === 0 ? 0 : ((v1 - v2) / Math.abs(v2)) * 100;

  // Gráfico de Composição (Donut)
  const chartData = useMemo(() => [
    { name: 'Caixa e Renda Fixa', value: b1.totalLiquidez, color: colors.success },
    { name: 'Seguros a Apropriar', value: b1.segurosAApropriar, color: colors.accent },
    { name: 'Imobilizado (Veículos)', value: b1.imobilizadoFipe, color: colors.primary },
  ].filter(d => d.value > 0), [b1, colors]);

  const indicators = useMemo(() => {
    const liqGeral = b1.totalPassivos > 0 ? b1.totalAtivos / b1.totalPassivos : b1.totalAtivos > 0 ? 99 : 0;
    const liqCorrente = b1.passivosCirculantes > 0 ? b1.ativosCirculantes / b1.passivosCirculantes : b1.ativosCirculantes > 0 ? 99 : 0;
    const endividamento = b1.totalAtivos > 0 ? (b1.totalPassivos / b1.totalAtivos) * 100 : 0;
    const imobilizacaoPL = b1.pl > 0 ? (b1.ativosNaoCirculantes / b1.pl) * 100 : 0;

    // Variações vs Anterior
    const prevLiqGeral = b2.totalPassivos > 0 ? b2.totalAtivos / b2.totalPassivos : 0;
    
    return [
      { label: "PL / Total de Ativos", value: `${b1.totalAtivos > 0 ? ((b1.pl / b1.totalAtivos) * 100).toFixed(1) : 0}%`, trend: calcVar(b1.pl / b1.totalAtivos, b2.pl / b2.totalAtivos) },
      { label: "Liquidez Geral", value: `${liqGeral.toFixed(2)}x`, trend: calcVar(liqGeral, prevLiqGeral) },
      { label: "Liquidez Corrente", value: `${liqCorrente.toFixed(2)}x`, trend: 0 },
      { label: "Endividamento", value: `${endividamento.toFixed(1)}%`, trend: calcVar(endividamento, b2.totalAtivos > 0 ? (b2.totalPassivos / b2.totalAtivos) * 100 : 0) },
      { label: "Cobertura de Ativos", value: `${liqGeral.toFixed(2)}x`, trend: 0 },
      { label: "Imobilização do PL", value: `${imobilizacaoPL.toFixed(1)}%`, trend: 0 },
    ];
  }, [b1, b2]);

  return (
    <div className="space-y-10 animate-fade-in">
      {/* GRID DE RESUMO (6 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ReportCard title="Total de Ativos" value={formatCurrency(b1.totalAtivos)} trend={calcVar(b1.totalAtivos, b2.totalAtivos)} status="success" size="sm" />
        <ReportCard title="Ativos Circulantes" value={formatCurrency(b1.ativosCirculantes)} trend={calcVar(b1.ativosCirculantes, b2.ativosCirculantes)} status="success" size="sm" />
        <ReportCard title="Inv. Não Circulantes" value={formatCurrency(b1.ativosNaoCirculantes)} trend={calcVar(b1.ativosNaoCirculantes, b2.ativosNaoCirculantes)} status="info" size="sm" />
        <ReportCard title="Total de Passivos" value={formatCurrency(b1.totalPassivos)} trend={calcVar(b1.totalPassivos, b2.totalPassivos)} status={b1.totalPassivos > 0 ? "danger" : "success"} size="sm" />
        <ReportCard title="Patrimônio Líquido" value={formatCurrency(b1.pl)} trend={calcVar(b1.pl, b2.pl)} status="success" size="sm" />
        <ReportCard title="Variação do PL" value={`${calcVar(b1.pl, b2.pl).toFixed(1)}%`} trend={calcVar(b1.pl, b2.pl)} status="neutral" size="sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* COLUNA ESQUERDA: ATIVO */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display font-black text-2xl uppercase tracking-tight">Ativo</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bens e Direitos</p>
            </div>
            <p className="text-2xl font-black text-success tabular-nums">{formatCurrency(b1.totalAtivos)}</p>
          </div>

          <div className="space-y-6">
            {/* Ativo Circulante */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Ativo Circulante (Alta Liquidez)</span>
                <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-lg">{(b1.ativosCirculantes / b1.totalAtivos * 100).toFixed(1)}%</span>
              </div>
              
              <div className="space-y-2">
                {b1.contasLiquidez.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{c.name}</p>
                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50">{ACCOUNT_TYPE_LABELS[c.accountType]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums">{formatCurrency(c.saldo)}</p>
                      <p className="text-[9px] font-bold text-muted-foreground">{c.percent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
                
                {b1.segurosAApropriar > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><Shield className="w-5 h-5 text-accent" /></div>
                      <div><p className="text-sm font-bold">Seguros a Apropriar (Prêmio)</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums">{formatCurrency(b1.segurosAApropriar)}</p>
                      <p className="text-[9px] font-bold text-muted-foreground">{(b1.segurosAApropriar / b1.totalAtivos * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ativo Não Circulante */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Ativo Não Circulante (Imobilizado)</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{(b1.ativosNaoCirculantes / b1.totalAtivos * 100).toFixed(1)}%</span>
              </div>
              
              <div className="space-y-2">
                {b1.imobilizadoFipe > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors"><Car className="w-5 h-5 text-muted-foreground group-hover:text-primary" /></div>
                      <div><p className="text-sm font-bold">Imobilizado (Veículos)</p><p className="text-[9px] font-black uppercase text-muted-foreground opacity-50">Avaliação FIPE</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums">{formatCurrency(b1.imobilizadoFipe)}</p>
                      <p className="text-[9px] font-bold text-muted-foreground">{(b1.imobilizadoFipe / b1.totalAtivos * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PASSIVO + PL */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display font-black text-2xl uppercase tracking-tight">Passivo + PL</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Obrigações e Capital Próprio</p>
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums">{formatCurrency(b1.totalAtivos)}</p>
          </div>

          <div className="space-y-6">
            {/* Passivo Circulante */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Passivo Circulante (até 12 meses)</span>
                <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg">{(b1.passivosCirculantes / b1.totalAtivos * 100).toFixed(1)}%</span>
              </div>
              
              <div className="space-y-2">
                {b1.dividaCartoes > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"><CreditCard className="w-5 h-5 text-muted-foreground" /></div><div><p className="text-sm font-bold">Saldo Devedor Cartões</p></div></div>
                    <div className="text-right"><p className="text-sm font-black tabular-nums">{formatCurrency(b1.dividaCartoes)}</p></div>
                  </div>
                )}
                {b1.principalEmprestimos12m > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"><Banknote className="w-5 h-5 text-muted-foreground" /></div><div><p className="text-sm font-bold">Principal Empréstimos (12 meses)</p></div></div>
                    <div className="text-right"><p className="text-sm font-black tabular-nums">{formatCurrency(b1.principalEmprestimos12m)}</p></div>
                  </div>
                )}
                {b1.segurosAPagar > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"><Shield className="w-5 h-5 text-muted-foreground" /></div><div><p className="text-sm font-bold">Seguros a Pagar (12 meses)</p></div></div>
                    <div className="text-right"><p className="text-sm font-black tabular-nums">{formatCurrency(b1.segurosAPagar)}</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Passivo Não Circulante */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Passivo Não Circulante (Longo Prazo)</span>
                <span className="text-[10px] font-bold text-destructive/60 bg-muted px-2 py-0.5 rounded-lg">{(b1.passivosNaoCirculantes / b1.totalAtivos * 100).toFixed(1)}%</span>
              </div>
              <div className="space-y-2">
                {b1.passivosNaoCirculantes > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 opacity-70">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"><History className="w-5 h-5 text-muted-foreground" /></div><div><p className="text-sm font-bold">Principal Empréstimos (Longo Prazo)</p></div></div>
                    <div className="text-right"><p className="text-sm font-black tabular-nums">{formatCurrency(b1.passivosNaoCirculantes)}</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Patrimônio Líquido */}
            <div className="pt-4 border-t border-border/40 space-y-3">
               <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Patrimônio Líquido</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{(b1.pl / b1.totalAtivos * 100).toFixed(1)}%</span>
              </div>
              <div className="p-5 rounded-[1.75rem] bg-primary/5 border-2 border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-sm"><Scale className="w-5 h-5" /></div><div><p className="text-sm font-black uppercase">Capital Próprio</p></div></div>
                <p className="text-xl font-black text-primary tabular-nums">{formatCurrency(b1.pl)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ: GRÁFICOS E INDICADORES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-soft border border-white/60 dark:border-white/5">
           <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-6">Composição dos Ativos</h4>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={12}>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "none", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
           </div>
           <div className="space-y-2 mt-4">
              {chartData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /> <span className="text-muted-foreground">{d.name}</span></div>
                  <span>{(d.value / b1.totalAtivos * 100).toFixed(0)}%</span>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center gap-3 px-1">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-display font-black text-xl uppercase tracking-tight">Indicadores Patrimoniais</h3>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {indicators.map((ind, i) => (
                <div key={i} className="p-6 rounded-3xl bg-card border border-border/40 shadow-sm hover:shadow-md transition-all">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{ind.label}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">{ind.value}</p>
                  {ind.trend !== 0 && (
                    <p className={cn("text-[9px] font-black mt-1 uppercase", ind.trend > 0 ? "text-success" : "text-destructive")}>
                      {ind.trend > 0 ? "+" : ""}{ind.trend.toFixed(1)}% vs anterior
                    </p>
                  )}
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}