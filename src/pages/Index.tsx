"use client";

import { useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { CockpitCards } from "@/components/dashboard/CockpitCards";
import { MovimentacoesRelevantes } from "@/components/dashboard/MovimentacoesRelevantes";
import { AcompanhamentoAtivos } from "@/components/dashboard/AcompanhamentoAtivos";
import { SaudeFinanceira } from "@/components/dashboard/SaudeFinanceira";
import { FluxoCaixaHeatmap } from "@/components/dashboard/FluxoCaixaHeatmap";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DateRange, ComparisonDateRanges, TransacaoCompleta } from "@/types/finance";
import { 
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
  Sparkles,
  LineChart,
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { parseDateLocal, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const { 
    transacoesV2,
    contasMovimento,
    categoriasV2,
    getAtivosTotal,
    getPassivosTotal,
    calculateBalanceUpToDate,
    dateRanges,
    setDateRanges,
  } = useFinance();

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  // --- Helper de Filtragem ---
  const filterTransactionsByRange = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return transacoesV2;
    const rangeFrom = startOfDay(range.from);
    const rangeTo = endOfDay(range.to);
    return transacoesV2.filter(t => {
      try {
        const transactionDate = parseDateLocal(t.date);
        return isWithinInterval(transactionDate, { start: rangeFrom, end: rangeTo });
      } catch {
        return false;
      }
    });
  }, [transacoesV2]);

  const transacoesPeriodo1 = useMemo(() => filterTransactionsByRange(dateRanges.range1), [filterTransactionsByRange, dateRanges.range1]);
  const transacoesPeriodo2 = useMemo(() => filterTransactionsByRange(dateRanges.range2), [filterTransactionsByRange, dateRanges.range2]);

  // --- Cálculos de Patrimônio (Period-Aware) ---
  const metricasPatrimoniais = useMemo(() => {
    const end1 = dateRanges.range1.to;
    const end2 = dateRanges.range2.to;

    const ativos1 = getAtivosTotal(end1);
    const passivos1 = getPassivosTotal(end1);
    const pl1 = ativos1 - passivos1;

    const ativos2 = getAtivosTotal(end2);
    const passivos2 = getPassivosTotal(end2);
    const pl2 = ativos2 - passivos2;

    const variacaoAbs = pl1 - pl2;
    const variacaoPerc = pl2 !== 0 ? (variacaoAbs / Math.abs(pl2)) * 100 : 0;

    // Liquidez Imediata (Contas Correntes, Poupança, Reserva, Renda Fixa)
    const contasLiquidez = contasMovimento.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)
    );
    const liquidezImediata = contasLiquidez.reduce((acc, c) => {
      const balance = calculateBalanceUpToDate(c.id, end1, transacoesV2, contasMovimento);
      return acc + Math.max(0, balance);
    }, 0);

    return { 
      plAtual: pl1, 
      ativosAtuais: ativos1, 
      passivosAtuais: passivos1, 
      variacaoAbs, 
      variacaoPerc,
      liquidezImediata 
    };
  }, [dateRanges, getAtivosTotal, getPassivosTotal, contasMovimento, transacoesV2, calculateBalanceUpToDate]);

  // --- Cálculos de Fluxo ---
  const fluxo = useMemo(() => {
    const calc = (txs: TransacaoCompleta[]) => {
      const rec = txs
        .filter(t => t.operationType === 'receita' || t.operationType === 'rendimento' || t.operationType === 'liberacao_emprestimo')
        .reduce((acc, t) => acc + t.amount, 0);
      const des = txs
        .filter(t => t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo' || t.operationType === 'veiculo')
        .reduce((acc, t) => acc + t.amount, 0);
      return { rec, des, saldo: rec - des };
    };

    const p1 = calc(transacoesPeriodo1);
    const p2 = calc(transacoesPeriodo2);

    const variacaoFluxoAbs = p1.saldo - p2.saldo;
    const variacaoFluxoPerc = p2.saldo !== 0 ? (variacaoFluxoAbs / Math.abs(p2.saldo)) * 100 : 0;

    return { p1, p2, variacaoFluxoAbs, variacaoFluxoPerc };
  }, [transacoesPeriodo1, transacoesPeriodo2]);

  // --- Métricas de Saúde Avançadas ---
  const saude = useMemo(() => {
    // 1. Diversificação (100 - maior peso de um grupo de ativos)
    const rf = metricasPatrimoniais.liquidezImediata;
    const veiculos = transacoesPeriodo1.filter(t => t.operationType === 'veiculo').length > 0 ? 0 : 0; // Simplificado para exemplo, ideal seria saldo atual
    // Para diversificação real, pegamos os saldos por categoria
    const pesos = [
      (metricasPatrimoniais.liquidezImediata / (metricasPatrimoniais.ativosAtuais || 1)) * 100,
      // ... outros pesos
    ];
    const maxPeso = Math.max(...pesos);
    const diversificacao = Math.max(0, 100 - (maxPeso - 25)); // 25% é uma base saudável

    // 2. Estabilidade de Fluxo (Variância entre p1 e p2)
    const estabilidade = fluxo.p2.saldo !== 0 ? Math.min(100, (fluxo.p1.saldo / fluxo.p2.saldo) * 100) : 100;

    // 3. Dependência de Renda (Maior Categoria de Receita / Receita Total)
    const receitasPorCat: Record<string, number> = {};
    transacoesPeriodo1.filter(t => t.operationType === 'receita').forEach(t => {
      const cat = t.categoryId || 'outros';
      receitasPorCat[cat] = (receitasPorCat[cat] || 0) + t.amount;
    });
    const maiorReceita = Math.max(...Object.values(receitasPorCat), 0);
    const dependencia = fluxo.p1.rec > 0 ? (maiorReceita / fluxo.p1.rec) * 100 : 0;

    return {
      liquidez: metricasPatrimoniais.passivosAtuais > 0 ? metricasPatrimoniais.ativosAtuais / metricasPatrimoniais.passivosAtuais : 2.5,
      endividamento: metricasPatrimoniais.ativosAtuais > 0 ? (metricasPatrimoniais.passivosAtuais / metricasPatrimoniais.ativosAtuais) * 100 : 0,
      diversificacao,
      estabilidade,
      dependencia
    };
  }, [metricasPatrimoniais, fluxo, transacoesPeriodo1]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-8 pb-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 animate-fade-in">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-lg shadow-primary/20 ring-4 ring-primary/10">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl leading-none tracking-tight">Orbium</h1>
                <p className="text-xs text-muted-foreground font-medium tracking-wide mt-0.5">Visão Premium</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="h-10 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm"
            />
          </div>
        </header>

        {/* Resumo Financeiro Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in-up">
          {/* Card Master de Patrimônio */}
          <div className="col-span-12 lg:col-span-8 bg-surface-light dark:bg-surface-dark rounded-[32px] p-8 shadow-soft relative overflow-hidden border border-white/60 dark:border-white/5 group h-[420px] flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50"></div>
            
            {/* SVG Background Chart - Estilizado */}
            <div className="absolute bottom-0 left-0 right-0 h-[280px] pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 250">
                <defs>
                  <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3"></stop>
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path className="transition-all duration-1000 ease-out translate-y-2 group-hover:translate-y-0" d="M0,250 L0,180 C100,170 200,210 300,180 C400,150 500,170 600,140 C700,110 750,130 800,100 L800,250 Z" fill="url(#chartFill)" opacity="0.4"></path>
                <path d="M0,250 L0,150 C120,130 240,190 360,130 C480,70 600,100 700,50 C760,20 780,40 800,80 L800,250 Z" fill="url(#chartFill)"></path>
                <path d="M0,150 C120,130 240,190 360,130 C480,70 600,100 700,50 C760,20 780,40 800,80" fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeWidth="4" vectorEffect="non-scaling-stroke"></path>
              </svg>
            </div>

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-primary">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Patrimônio Líquido</span>
                </div>
                <h2 className="font-display font-extrabold text-5xl sm:text-6xl text-foreground tracking-tight leading-none mt-4 tabular-nums">
                  {formatCurrency(metricasPatrimoniais.plAtual)}
                </h2>
                <div className="flex items-center gap-2 mt-4">
                   <p className="text-muted-foreground font-medium tabular-nums">
                    {metricasPatrimoniais.variacaoAbs >= 0 ? "+" : "-"} {formatCurrency(Math.abs(metricasPatrimoniais.variacaoAbs))}
                  </p>
                  <Badge variant="outline" className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-lg border-none",
                    metricasPatrimoniais.variacaoAbs >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}>
                    {metricasPatrimoniais.variacaoAbs >= 0 ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                    {Math.abs(metricasPatrimoniais.variacaoPerc).toFixed(1)}% {metricasPatrimoniais.variacaoAbs >= 0 ? 'de evolução' : 'de redução'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Liquidez e Carteira */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <CockpitCards data={{
              patrimonioTotal: metricasPatrimoniais.plAtual,
              variacaoPatrimonio: metricasPatrimoniais.variacaoAbs,
              variacaoPercentual: metricasPatrimoniais.variacaoPerc,
              liquidezImediata: metricasPatrimoniais.liquidezImediata,
              compromissosMes: fluxo.p1.des,
              projecao30Dias: fluxo.p1.saldo, // Simplificado
              totalAtivos: metricasPatrimoniais.ativosAtuais
            }} />
          </div>
        </div>

        {/* Linha de KPIs Secundários */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="col-span-1 md:col-span-2 bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex flex-col justify-center h-[160px] hover:-translate-y-1 transition-transform duration-300">
             <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-700 dark:text-green-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-lg">
                {fluxo.variacaoFluxoPerc >= 0 ? '+' : ''}{fluxo.variacaoFluxoPerc.toFixed(1)}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">Resultado Operacional</p>
              <p className="font-display font-bold text-3xl text-foreground tabular-nums">{formatCurrency(fluxo.p1.saldo)}</p>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex flex-col justify-center h-[160px] hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase">Mês Atual</Badge>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">Despesas Totais</p>
              <p className="font-display font-bold text-3xl text-foreground tabular-nums">{formatCurrency(fluxo.p1.des)}</p>
            </div>
          </div>

          <div className="col-span-1 md:col-span-4 bg-gradient-to-r from-neutral-800 to-neutral-900 text-white rounded-[32px] p-6 shadow-lg flex items-center justify-between relative overflow-hidden h-[160px]">
             <div className="absolute right-0 bottom-0 opacity-10 scale-150 translate-x-10 translate-y-10">
              <Sparkles className="w-[180px] h-[180px]" />
            </div>
            <div className="z-10">
              <h3 className="font-display font-bold text-2xl mb-1">Score Orbium</h3>
              <p className="text-neutral-400 text-sm mb-4 max-w-[200px]">Saúde patrimonial com base em {contasMovimento.length} contas.</p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase backdrop-blur-md border border-white/10">Estável</span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase backdrop-blur-md border border-white/10">Prêmio</span>
              </div>
            </div>
            <div className="z-10 text-right">
              <div className="w-24 h-24 rounded-full border-4 border-primary/50 flex items-center justify-center bg-white/5 backdrop-blur-sm relative">
                <span className="font-display font-bold text-3xl">850</span>
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent -rotate-45"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Principal de Conteúdo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <SaudeFinanceira
                liquidez={saude.liquidez}
                endividamento={saude.endividamento}
                diversificacao={saude.diversificacao}
                estabilidadeFluxo={saude.estabilidade}
                dependenciaRenda={saude.dependencia}
              />
            </section>
            
            <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <FluxoCaixaHeatmap 
                month={dateRanges.range1.from ? format(dateRanges.range1.from, 'MM') : format(new Date(), 'MM')} 
                year={dateRanges.range1.from ? dateRanges.range1.from.getFullYear() : new Date().getFullYear()} 
                transacoes={transacoesPeriodo1} 
              />
            </section>
          </div>

          <div className="space-y-8">
            <section className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <AcompanhamentoAtivos
                investimentosRF={contasMovimento.filter(c => c.accountType === 'renda_fixa').reduce((a, c) => a + calculateBalanceUpToDate(c.id, dateRanges.range1.to, transacoesV2, contasMovimento), 0)}
                criptomoedas={contasMovimento.filter(c => c.accountType === 'cripto' && !c.name.toLowerCase().includes('stable')).reduce((a, c) => a + calculateBalanceUpToDate(c.id, dateRanges.range1.to, transacoesV2, contasMovimento), 0)}
                stablecoins={contasMovimento.filter(c => c.accountType === 'cripto' && c.name.toLowerCase().includes('stable')).reduce((a, c) => a + calculateBalanceUpToDate(c.id, dateRanges.range1.to, transacoesV2, contasMovimento), 0)}
                reservaEmergencia={contasMovimento.filter(c => c.accountType === 'reserva').reduce((a, c) => a + calculateBalanceUpToDate(c.id, dateRanges.range1.to, transacoesV2, contasMovimento), 0)}
                poupanca={contasMovimento.filter(c => c.accountType === 'poupanca').reduce((a, c) => a + calculateBalanceUpToDate(c.id, dateRanges.range1.to, transacoesV2, contasMovimento), 0)}
              />
            </section>

            <section className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <MovimentacoesRelevantes transacoes={transacoesPeriodo1} limit={5} />
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;