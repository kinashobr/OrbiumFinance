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
  Sparkles
} from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths, subDays, startOfDay, endOfDay } from "date-fns";
import { parseDateLocal } from "@/lib/utils";

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
        {/* Cabeçalho Expressivo */}
        <header className="space-y-4 animate-fade-in px-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Cockpit Financeiro</h1>
              </div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-warning" />
                Bem-vindo ao seu centro de comando patrimonial
              </p>
            </div>
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="hidden sm:flex h-10 rounded-2xl bg-card border-border/60 shadow-xs"
            />
          </div>
          
          <div className="sm:hidden">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="w-full h-10 rounded-2xl bg-card border-border/60"
            />
          </div>
        </header>

        {/* KPIs Principais */}
        <section className="animate-fade-in-up">
          <CockpitCards data={cockpitData} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Lista de Movimentações */}
            <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <MovimentacoesRelevantes transacoes={transacoesPeriodo1} limit={6} />
            </section>
            
            {/* Mapa de Calor do Fluxo */}
            <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <FluxoCaixaHeatmap 
                month={dateRanges.range1.from ? format(dateRanges.range1.from, 'MM') : format(new Date(), 'MM')} 
                year={dateRanges.range1.from ? dateRanges.range1.from.getFullYear() : new Date().getFullYear()} 
                transacoes={transacoesPeriodo1} 
              />
            </section>
          </div>

          <div className="space-y-8">
            {/* Widgets de Contexto Lateral */}
            <section className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <AcompanhamentoAtivos
                investimentosRF={saldosPorConta.filter(c => c.accountType === 'renda_fixa' || c.accountType === 'poupanca').reduce((a, c) => a + c.saldo, 0)}
                criptomoedas={saldosPorConta.filter(c => c.accountType === 'cripto' && !c.name.toLowerCase().includes('stable')).reduce((a, c) => a + c.saldo, 0)}
                stablecoins={saldosPorConta.filter(c => c.accountType === 'cripto' && c.name.toLowerCase().includes('stable')).reduce((a, c) => a + c.saldo, 0)}
                reservaEmergencia={saldosPorConta.filter(c => c.accountType === 'reserva').reduce((a, c) => a + c.saldo, 0)}
                poupanca={saldosPorConta.filter(c => c.accountType === 'poupanca').reduce((a, c) => a + c.saldo, 0)}
              />
            </section>
            
            <section className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <SaudeFinanceira
                liquidez={liquidezRatio}
                endividamento={endividamentoPercent}
                diversificacao={diversificacaoPercent}
                estabilidadeFluxo={mesesPositivos}
                dependenciaRenda={dependenciaRenda}
              />
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;