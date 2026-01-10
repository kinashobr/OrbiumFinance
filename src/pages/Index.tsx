"use client";

import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { CockpitCards } from "@/components/dashboard/CockpitCards";
import { MovimentacoesRelevantes } from "@/components/dashboard/MovimentacoesRelevantes";
import { AcompanhamentoAtivos } from "@/components/dashboard/AcompanhamentoAtivos";
import { SaudeFinanceira } from "@/components/dashboard/SaudeFinanceira";
import { FluxoCaixaHeatmap } from "@/components/dashboard/FluxoCaixaHeatmap";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DateRange, ComparisonDateRanges } from "@/types/finance";
import { 
  Activity,
  LayoutDashboard,
  Sparkles,
  Wallet,
  CalendarDays
} from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths, subDays, startOfDay, endOfDay } from "date-fns";
import { parseDateLocal } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { 
    transacoesV2,
    contasMovimento,
    categoriasV2,
    getValorFipeTotal,
    getAtivosTotal,
    getPassivosTotal,
    getSaldoDevedor,
    calculateBalanceUpToDate,
    dateRanges,
    setDateRanges,
  } = useFinance();

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const filterTransactionsByRange = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return transacoesV2;
    const rangeFrom = startOfDay(range.from);
    const rangeTo = endOfDay(range.to);
    return transacoesV2.filter(t => {
      const transactionDate = parseDateLocal(t.date);
      return isWithinInterval(transactionDate, { start: rangeFrom, end: rangeTo });
    });
  }, [transacoesV2]);

  const transacoesPeriodo1 = useMemo(() => filterTransactionsByRange(dateRanges.range1), [filterTransactionsByRange, dateRanges.range1]);
  const transacoesPeriodo2 = useMemo(() => filterTransactionsByRange(dateRanges.range2), [filterTransactionsByRange, dateRanges.range2]);

  const saldosPorConta = useMemo(() => {
    const targetDate = dateRanges.range1.to;
    return contasMovimento.map(conta => {
      const saldo = calculateBalanceUpToDate(conta.id, targetDate, transacoesV2, contasMovimento);
      return { ...conta, saldo };
    });
  }, [contasMovimento, transacoesV2, dateRanges.range1.to, calculateBalanceUpToDate]);

  const liquidezImediata = useMemo(() => {
    return saldosPorConta
      .filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType))
      .reduce((acc, c) => acc + c.saldo, 0);
  }, [saldosPorConta]);

  const totalAtivosPeriodo = useMemo(() => getAtivosTotal(dateRanges.range1.to), [getAtivosTotal, dateRanges.range1.to]);
  const totalDividas = useMemo(() => getPassivosTotal(dateRanges.range1.to), [getPassivosTotal, dateRanges.range1.to]);
  const patrimonioTotal = totalAtivosPeriodo - totalDividas;

  const receitasPeriodo1 = useMemo(() => transacoesPeriodo1.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento')).reduce((acc, t) => acc + t.amount, 0), [transacoesPeriodo1]);
  const despesasPeriodo1 = useMemo(() => transacoesPeriodo1.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo')).reduce((acc, t) => acc + t.amount, 0), [transacoesPeriodo1]);
  const receitasPeriodo2 = useMemo(() => transacoesPeriodo2.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento')).reduce((acc, t) => acc + t.amount, 0), [transacoesPeriodo2]);
  const despesasPeriodo2 = useMemo(() => transacoesPeriodo2.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo')).reduce((acc, t) => acc + t.amount, 0), [transacoesPeriodo2]);

  const saldoPeriodo1 = receitasPeriodo1 - despesasPeriodo1;
  const saldoPeriodo2 = receitasPeriodo2 - despesasPeriodo2;
  const variacaoPatrimonio = saldoPeriodo1 - saldoPeriodo2;
  const variacaoPercentual = saldoPeriodo2 !== 0 ? ((saldoPeriodo1 - saldoPeriodo2) / Math.abs(saldoPeriodo2)) * 100 : 0;

  const diasNoPeriodo = dateRanges.range1.from && dateRanges.range1.to ? (dateRanges.range1.to.getTime() - dateRanges.range1.from.getTime()) / (1000 * 60 * 60 * 24) : 30;
  const projecao30Dias = saldoPeriodo1 + ((diasNoPeriodo > 0 ? saldoPeriodo1 / diasNoPeriodo : 0) * 30);

  const cockpitData = {
    patrimonioTotal,
    variacaoPatrimonio,
    variacaoPercentual,
    liquidezImediata,
    compromissosMes: despesasPeriodo1,
    projecao30Dias,
  };

  const liquidezRatio = totalDividas > 0 ? totalAtivosPeriodo / totalDividas : 999;
  const endividamentoPercent = totalAtivosPeriodo > 0 ? (totalDividas / totalAtivosPeriodo) * 100 : 0;
  const tiposAtivos = [
    saldosPorConta.some(c => (c.accountType === 'renda_fixa' || c.accountType === 'poupanca') && c.saldo > 0),
    saldosPorConta.some(c => c.accountType === 'cripto' && !c.name.toLowerCase().includes('stable') && c.saldo > 0),
    saldosPorConta.some(c => c.accountType === 'cripto' && c.name.toLowerCase().includes('stable') && c.saldo > 0),
    saldosPorConta.some(c => c.accountType === 'reserva' && c.saldo > 0),
    saldosPorConta.some(c => c.accountType === 'corrente' && c.saldo > 0),
    getValorFipeTotal(dateRanges.range1.to) > 0,
  ].filter(Boolean).length;
  const diversificacaoPercent = (tiposAtivos / 6) * 100;

  const mesesPositivos = useMemo(() => {
    const results = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const data = subMonths(now, i);
      const m = data.getMonth();
      const y = data.getFullYear();
      const txMes = transacoesV2.filter(t => {
        const d = parseDateLocal(t.date);
        return d.getMonth() === m && d.getFullYear() === y;
      });
      const rec = txMes.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento')).reduce((a, t) => a + t.amount, 0);
      const desp = txMes.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo')).reduce((a, t) => a + t.amount, 0);
      results.push(rec > desp);
    }
    return (results.filter(Boolean).length / 6) * 100;
  }, [transacoesV2]);

  const despesasFixasPeriodo = useMemo(() => {
    const catMap = new Map(categoriasV2.map(c => [c.id, c]));
    return transacoesPeriodo1.filter(t => catMap.get(t.categoryId || '')?.nature === 'despesa_fixa').reduce((acc, t) => acc + t.amount, 0);
  }, [transacoesPeriodo1, categoriasV2]);
  const dependenciaRenda = receitasPeriodo1 > 0 ? (despesasFixasPeriodo / receitasPeriodo1) * 100 : 0;

  return (
    <MainLayout>
      <div className="space-y-8 pb-10">
        {/* Cabeçalho Expressivo (Desktop/Mobile) */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-1 md:px-6 py-4 md:py-6 flex justify-between items-center border-b border-border/0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg shadow-primary/20 ring-4 ring-primary/10 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xl md:text-3xl text-foreground tracking-tight">Visão Geral</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Bem-vindo de volta, investidor.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden md:flex items-center gap-2 bg-card pl-4 pr-3 py-2.5 rounded-full border border-border/60 shadow-sm hover:bg-muted/50 transition-all"
            >
              <span className="text-xs font-bold tracking-wide text-primary uppercase">
                {dateRanges.range1.from ? format(dateRanges.range1.from, 'MMMM yyyy', { locale: new Intl.Locale('pt-BR') }) : 'Selecione o Período'}
              </span>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </header>

        {/* Grid Principal (Desktop: 3 colunas, Mobile: 2 colunas) */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6">
          
          {/* 1. Card Principal (Patrimônio) - Ocupa 2 colunas no mobile, 8 no desktop */}
          <section className="col-span-2 lg:col-span-8 animate-fade-in-up">
            <CockpitCards data={cockpitData} />
          </section>

          {/* 2. Liquidez e Carteira (Mobile: 1 coluna cada, Desktop: 4 colunas) */}
          <section className="col-span-2 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
            <div className="col-span-1 lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <AcompanhamentoAtivos
                investimentosRF={saldosPorConta.filter(c => c.accountType === 'renda_fixa' || c.accountType === 'poupanca').reduce((a, c) => a + c.saldo, 0)}
                criptomoedas={saldosPorConta.filter(c => c.accountType === 'cripto' && !c.name.toLowerCase().includes('stable')).reduce((a, c) => a + c.saldo, 0)}
                stablecoins={saldosPorConta.filter(c => c.accountType === 'cripto' && c.name.toLowerCase().includes('stable')).reduce((a, c) => a + c.saldo, 0)}
                reservaEmergencia={saldosPorConta.filter(c => c.accountType === 'reserva').reduce((a, c) => a + c.saldo, 0)}
                poupanca={saldosPorConta.filter(c => c.accountType === 'poupanca').reduce((a, c) => a + c.saldo, 0)}
              />
            </div>
            <div className="col-span-1 lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <SaudeFinanceira
                liquidez={liquidezRatio}
                endividamento={endividamentoPercent}
                diversificacao={diversificacaoPercent}
                estabilidadeFluxo={mesesPositivos}
                dependenciaRenda={dependenciaRenda}
              />
            </div>
          </section>

          {/* 3. Heatmap e Movimentações (Desktop: 8 colunas) */}
          <section className="col-span-2 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="col-span-1 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <FluxoCaixaHeatmap 
                month={dateRanges.range1.from ? format(dateRanges.range1.from, 'MM') : format(new Date(), 'MM')} 
                year={dateRanges.range1.from ? dateRanges.range1.from.getFullYear() : new Date().getFullYear()} 
                transacoes={transacoesPeriodo1} 
              />
            </div>
            <div className="col-span-1 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <MovimentacoesRelevantes transacoes={transacoesPeriodo1} limit={6} />
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;