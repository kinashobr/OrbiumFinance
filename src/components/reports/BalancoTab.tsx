import { useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Wallet,
  Building2,
  Car,
  CreditCard,
  Landmark,
  PieChart,
  LineChart,
  Banknote,
  PiggyBank,
  Bitcoin,
  Target,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Droplets,
  Shield,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
import { IndicatorBadge } from "./IndicatorBadge";
import { DetailedIndicatorBadge } from "./DetailedIndicatorBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, parseDateLocal } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS } from "@/types/finance";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, subDays, startOfDay, endOfDay, addMonths, isBefore, isAfter, isSameDay, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComparisonDateRanges, DateRange } from "@/types/finance";
import { ContaCorrente, TransacaoCompleta } from "@/types/finance";
import { EvolucaoPatrimonialChart } from "@/components/dashboard/EvolucaoPatrimonialChart";

const COLORS = {
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 72%, 51%)",
  primary: "hsl(199, 89%, 48%)",
  accent: "hsl(270, 80% 60%)",
  muted: "hsl(215, 20% 55%)",
  gold: "hsl(45, 93%, 47%)",
  cyan: "hsl(180, 70%, 50%)",
};

const PIE_COLORS = [
  COLORS.primary,
  COLORS.accent,
  COLORS.success,
  COLORS.warning,
  COLORS.gold,
  COLORS.cyan,
  COLORS.danger,
];

type IndicatorStatus = "success" | "warning" | "danger" | "neutral";

interface BalancoTabProps {
  dateRanges: ComparisonDateRanges;
}

const CustomPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.1;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  return (
    <text 
      x={x} 
      y={y} 
      fill="hsl(var(--foreground))" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize={12}
    >
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export function BalancoTab({ dateRanges }: BalancoTabProps) {
  const {
    transacoesV2,
    contasMovimento,
    emprestimos,
    veiculos,
    categoriasV2,
    segurosVeiculo,
    getAtivosTotal,
    getPassivosTotal,
    getPatrimonioLiquido,
    calculateBalanceUpToDate,
    calculatePaidInstallmentsUpToDate,
    getValorFipeTotal,
    getSegurosAApropriar,
    getSegurosAPagar,
    calculateLoanPrincipalDueInNextMonths,
    calculateLoanSchedule,
    getSaldoDevedor,
    getCreditCardDebt,
    getLoanPrincipalRemaining,
  } = useFinance();

  const { range1, range2 } = dateRanges;

  const filterTransactionsByRange = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return transacoesV2;
    
    const rangeFrom = startOfDay(range.from);
    const rangeTo = endOfDay(range.to);
    
    return transacoesV2.filter(t => {
      try {
        const dataT = parseDateLocal(t.date);
        return isWithinInterval(dataT, { start: rangeFrom, end: rangeTo });
      } catch {
        return false;
      }
    });
  }, [transacoesV2]);

  const transacoesPeriodo1 = useMemo(() => filterTransactionsByRange(range1), [filterTransactionsByRange, range1]);
  const transacoesPeriodo2 = useMemo(() => filterTransactionsByRange(range2), [filterTransactionsByRange, range2]);

  const calculateFinalBalances = useCallback((transactions: typeof transacoesV2, periodStart: Date | undefined, periodEnd: Date | undefined) => {
    const saldos: Record<string, number> = {};
    
    contasMovimento.forEach(conta => {
      const saldoFinalPeriodo = calculateBalanceUpToDate(conta.id, periodEnd, transacoesV2, contasMovimento);
      saldos[conta.id] = saldoFinalPeriodo;
    });

    return saldos;
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);

  const calculatePercentChange = useCallback((value1: number, value2: number) => {
    if (value2 === 0) return 0;
    return ((value1 - value2) / Math.abs(value2)) * 100;
  }, []);

  const calculateBalanco = useCallback((range: DateRange) => {
    const targetDate = range.to;
    const periodStart = range.from;
    const finalDate = targetDate || new Date(9999, 11, 31);

    const saldosPorConta = calculateFinalBalances(transacoesV2, periodStart, finalDate);
    const totalAtivos = getAtivosTotal(finalDate);

    const contasCirculantes = contasMovimento.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)
    );
    const caixaEquivalentes = contasCirculantes.reduce((acc, c) => acc + Math.max(0, saldosPorConta[c.id] || 0), 0);
    const segurosAApropriar = getSegurosAApropriar(finalDate);
    
    const contasInvestimentoNaoCirculante = contasMovimento.filter(c => 
      ['cripto', 'objetivo'].includes(c.accountType)
    );
    
    const saldoCripto = contasInvestimentoNaoCirculante.filter(c => c.accountType === 'cripto' && !c.name.toLowerCase().includes('stable')).reduce((acc, c) => acc + Math.max(0, saldosPorConta[c.id] || 0), 0);
    const saldoStable = contasInvestimentoNaoCirculante.filter(c => c.accountType === 'cripto' && c.name.toLowerCase().includes('stable')).reduce((acc, c) => acc + Math.max(0, saldosPorConta[c.id] || 0), 0);
    const saldoObjetivos = contasInvestimentoNaoCirculante.filter(c => c.accountType === 'objetivo').reduce((acc, c) => acc + Math.max(0, saldosPorConta[c.id] || 0), 0);
    
    const investimentosNaoCirculantes = saldoCripto + saldoStable + saldoObjetivos;
    const valorVeiculos = getValorFipeTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    const saldoDevedorCartoes = getCreditCardDebt(finalDate);
    const segurosAPagarTotal = getSegurosAPagar(finalDate);
    const totalLoanPrincipalRemaining = getLoanPrincipalRemaining(finalDate);
    const loanPrincipalShortTerm = calculateLoanPrincipalDueInNextMonths(finalDate, 12);
    
    let segurosAPagarShortTerm = 0;
    const lookaheadDate = addMonths(finalDate, 12);
    
    segurosVeiculo.forEach(seguro => {
        seguro.parcelas.forEach(parcela => {
            const dueDate = parseDateLocal(parcela.vencimento);
            if (!parcela.paga && (isBefore(dueDate, lookaheadDate) || isSameDay(dueDate, lookaheadDate)) && isAfter(dueDate, finalDate)) {
                segurosAPagarShortTerm += parcela.valor;
            }
        });
    });
    
    segurosAPagarShortTerm = Math.min(segurosAPagarShortTerm, segurosAPagarTotal);
    const passivoCurtoPrazo = saldoDevedorCartoes + loanPrincipalShortTerm + segurosAPagarShortTerm; 
    const loanPrincipalLongTerm = Math.max(0, totalLoanPrincipalRemaining - loanPrincipalShortTerm);
    const segurosAPagarLongoPrazo = Math.max(0, segurosAPagarTotal - segurosAPagarShortTerm);
    const passivoLongoPrazo = loanPrincipalLongTerm + segurosAPagarLongoPrazo;
    const patrimonioLiquido = totalAtivos - totalPassivos;

    return {
      saldosPorConta,
      ativos: {
        circulantes: { 
            caixa: caixaEquivalentes, 
            rendaFixa: caixaEquivalentes,
            segurosAApropriar: segurosAApropriar,
        },
        naoCirculantes: { 
            investimentos: investimentosNaoCirculantes, 
            criptoativos: saldoCripto, 
            stablecoins: saldoStable, 
            objetivos: saldoObjetivos, 
            veiculos: valorVeiculos 
        },
        total: totalAtivos,
      },
      passivos: {
        curtoPrazo: passivoCurtoPrazo,
        longoPrazo: passivoLongoPrazo,
        total: totalPassivos,
        emprestimos: emprestimos.filter(e => e.status !== 'quitado'),
        saldoDevedorCartoes,
        loanPrincipalShortTerm,
        loanPrincipalLongTerm,
        segurosAPagar: segurosAPagarTotal,
        segurosAPagarShortTerm,
        segurosAPagarLongoPrazo,
      },
      patrimonioLiquido,
    };
  }, [contasMovimento, emprestimos, veiculos, transacoesV2, segurosVeiculo, calculateFinalBalances, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getCreditCardDebt, getLoanPrincipalRemaining]);

  const balanco1 = useMemo(() => calculateBalanco(range1), [calculateBalanco, range1]);
  const balanco2 = useMemo(() => calculateBalanco(range2), [calculateBalanco, range2]);

  const variacoes = useMemo(() => {
    if (!range2.from) return {};
    
    return {
      ativosTotal: calculatePercentChange(balanco1.ativos.total, balanco2.ativos.total),
      circulantes: calculatePercentChange(balanco1.ativos.circulantes.caixa + balanco1.ativos.circulantes.segurosAApropriar, balanco2.ativos.circulantes.caixa + balanco2.ativos.circulantes.segurosAApropriar),
      investimentos: calculatePercentChange(balanco1.ativos.naoCirculantes.investimentos, balanco2.ativos.naoCirculantes.investimentos),
      passivosTotal: calculatePercentChange(balanco1.passivos.total, balanco2.passivos.total),
      patrimonioLiquido: calculatePercentChange(balanco1.patrimonioLiquido, balanco2.patrimonioLiquido),
    };
  }, [balanco1, balanco2, range2.from, calculatePercentChange]);

  const metricas = useMemo(() => {
    const plAtivos = balanco1.ativos.total > 0 ? (balanco1.patrimonioLiquido / balanco1.ativos.total) * 100 : 0;
    const liquidezGeral = balanco1.passivos.total > 0 ? balanco1.ativos.total / balanco1.passivos.total : 999;
    const passivoCurtoPrazo = balanco1.passivos.curtoPrazo;
    const liquidezCorrente = passivoCurtoPrazo > 0 
      ? (balanco1.ativos.circulantes.caixa + balanco1.ativos.circulantes.segurosAApropriar) / passivoCurtoPrazo 
      : 999;
    const endividamento = balanco1.ativos.total > 0 ? (balanco1.passivos.total / balanco1.ativos.total) * 100 : 0;
    const coberturaAtivos = balanco1.passivos.total > 0 ? balanco1.ativos.total / balanco1.passivos.total : 999;
    const imobilizacao = balanco1.patrimonioLiquido > 0 
      ? (balanco1.ativos.naoCirculantes.veiculos / balanco1.patrimonioLiquido) * 100 
      : 0;

    return {
      plAtivos: { 
        valor: plAtivos, 
        status: (plAtivos >= 50 ? "success" : plAtivos >= 30 ? "warning" : "danger") as IndicatorStatus 
      },
      liquidezGeral: { 
        valor: liquidezGeral, 
        status: (liquidezGeral >= 2 ? "success" : liquidezGeral >= 1 ? "warning" : "danger") as IndicatorStatus 
      },
      liquidezCorrente: { 
        valor: liquidezCorrente, 
        status: (liquidezCorrente >= 1.5 ? "success" : liquidezCorrente >= 1 ? "warning" : "danger") as IndicatorStatus 
      },
      endividamento: { 
        valor: endividamento, 
        status: (endividamento < 30 ? "success" : endividamento < 50 ? "warning" : "danger") as IndicatorStatus 
      },
      coberturaAtivos: { 
        valor: coberturaAtivos, 
        status: (coberturaAtivos >= 2 ? "success" : coberturaAtivos >= 1 ? "warning" : "danger") as IndicatorStatus 
      },
      imobilizacao: { 
        valor: imobilizacao, 
        status: (imobilizacao < 30 ? "success" : imobilizacao < 50 ? "warning" : "danger") as IndicatorStatus 
      },
    };
  }, [balanco1]);

  const composicaoAtivos = useMemo(() => {
    const items = [
      { name: "Caixa e Renda Fixa", value: balanco1.ativos.circulantes.caixa, color: COLORS.primary },
      { name: "Seguros a Apropriar", value: balanco1.ativos.circulantes.segurosAApropriar, color: COLORS.cyan },
      { name: "Criptoativos", value: balanco1.ativos.naoCirculantes.criptoativos, color: COLORS.gold },
      { name: "Stablecoins", value: balanco1.ativos.naoCirculantes.stablecoins, color: COLORS.cyan },
      { name: "Objetivos", value: balanco1.ativos.naoCirculantes.objetivos, color: COLORS.accent },
      { name: "Veículos", value: balanco1.ativos.naoCirculantes.veiculos, color: COLORS.warning },
    ].filter(item => item.value > 0);

    return items;
  }, [balanco1]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatRatio = (value: number) => value >= 999 ? "∞" : `${value.toFixed(2)}x`;

  const generateSparkline = (current: number, trend: "up" | "down" | "stable" = "stable") => {
    const base = Math.abs(current) * 0.7;
    const range = Math.abs(current) * 0.3 || 10;
    return Array.from({ length: 6 }, (_, i) => {
      const progress = i / 5;
      if (trend === "up") return base + range * progress + Math.random() * range * 0.2;
      if (trend === "down") return base + range * (1 - progress) + Math.random() * range * 0.2;
      return base + range * 0.5 + (Math.random() - 0.5) * range * 0.4;
    }).concat([Math.abs(current)]);
  };

  const getTrend = (percent: number, isInverse: boolean = false): "up" | "down" | "stable" => {
    if (!range2.from) return "stable";
    if (Math.abs(percent) < 0.1) return "stable";
    if (isInverse) return percent < 0 ? "up" : "down";
    return percent > 0 ? "up" : "down";
  };

  return (
    <div className="space-y-6">
      {/* Indicadores Patrimoniais (Resumo em cards padrão KpiCard) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Total de Ativos"
          value={formatCurrency(balanco1.ativos.total)}
          status="success"
          icon={<TrendingUp className="w-6 h-6" />}
          tooltip="Soma de todos os bens e direitos: caixa, investimentos, veículos"
          delay={0}
          trend={variacoes.ativosTotal}
          trendLabel={range2.from ? "anterior" : undefined}
        />
        <ReportCard
          title="Ativos Circulantes"
          value={formatCurrency(balanco1.ativos.circulantes.caixa + balanco1.ativos.circulantes.segurosAApropriar)}
          status="success"
          icon={<Banknote className="w-6 h-6" />}
          tooltip="Recursos de alta liquidez: contas correntes, poupança, reserva, renda fixa e seguros a apropriar"
          delay={50}
          trend={variacoes.circulantes}
          trendLabel={range2.from ? "anterior" : undefined}
        />
        <ReportCard
          title="Investimentos Não Circulantes"
          value={formatCurrency(balanco1.ativos.naoCirculantes.investimentos)}
          status="success"
          icon={<PiggyBank className="w-6 h-6" />}
          tooltip="Criptoativos e Objetivos de longo prazo"
          delay={100}
          trend={variacoes.investimentos}
          trendLabel={range2.from ? "anterior" : undefined}
        />
        <ReportCard
          title="Total de Passivos"
          value={formatCurrency(balanco1.passivos.total)}
          status={balanco1.passivos.total > 0 ? "danger" : "success"}
          icon={<TrendingDown className="w-6 h-6" />}
          tooltip="Soma de todas as obrigações: empréstimos, cartões de crédito e seguros a pagar"
          delay={150}
          trend={variacoes.passivosTotal}
          trendLabel={range2.from ? "anterior" : undefined}
        />
        <ReportCard
          title="Patrimônio Líquido"
          value={formatCurrency(balanco1.patrimonioLiquido)}
          status={balanco1.patrimonioLiquido >= 0 ? "success" : "danger"}
          icon={<Scale className="w-6 h-6" />}
          tooltip="Ativos - Passivos = Riqueza Líquida"
          delay={200}
          trend={variacoes.patrimonioLiquido}
          trendLabel={range2.from ? "anterior" : undefined}
        />
        <ReportCard
          title="Variação do PL"
          value={formatPercent(variacoes.patrimonioLiquido || 0)}
          trend={variacoes.patrimonioLiquido}
          trendLabel="anterior"
          status={getTrend(variacoes.patrimonioLiquido || 0) === "up" ? "success" : "danger"}
          icon={<LineChart className="w-6 h-6" />}
          tooltip={`Variação do Patrimônio Líquido comparado ao período anterior. Diferença: ${formatCurrency(balanco1.patrimonioLiquido - balanco2.patrimonioLiquido)}`}
          delay={250}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel
          title="ATIVO"
          subtitle="Bens e direitos"
          icon={<Wallet className="w-4 h-4" />}
          badge={formatCurrency(balanco1.ativos.total)}
          badgeStatus="success"
          defaultExpanded={true}
        >
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/30">
                  <TableHead className="text-muted-foreground">Conta</TableHead>
                  <TableHead className="text-muted-foreground text-right">Valor</TableHead>
                  <TableHead className="text-muted-foreground text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-border bg-success/5">
                  <TableCell colSpan={3} className="font-semibold text-success text-sm">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      ATIVO CIRCULANTE (Alta Liquidez)
                    </div>
                  </TableCell>
                </TableRow>
                {contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)).map(conta => (
                  <TableRow key={conta.id} className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      {conta.name}
                      <span className="text-xs text-muted-foreground">({ACCOUNT_TYPE_LABELS[conta.accountType]})</span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {formatCurrency(balanco1.saldosPorConta[conta.id] || 0)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent(((balanco1.saldosPorConta[conta.id] || 0) / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                ))}
                {balanco1.ativos.circulantes.segurosAApropriar > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Shield className="w-3 h-3 text-primary" />
                      Seguros a Apropriar (Prêmio)
                    </TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {formatCurrency(balanco1.ativos.circulantes.segurosAApropriar)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.ativos.circulantes.segurosAApropriar / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-border bg-muted/20">
                  <TableCell className="font-medium text-foreground pl-4">Subtotal Circulante</TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatCurrency(balanco1.ativos.circulantes.caixa + balanco1.ativos.circulantes.segurosAApropriar)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {balanco1.ativos.total > 0 ? formatPercent(((balanco1.ativos.circulantes.caixa + balanco1.ativos.circulantes.segurosAApropriar) / balanco1.ativos.total) * 100) : "0%"}
                  </TableCell>
                </TableRow>

                <TableRow className="border-border bg-primary/5">
                  <TableCell colSpan={3} className="font-semibold text-primary text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      ATIVO NÃO CIRCULANTE (Longo Prazo / Imobilizado)
                    </div>
                  </TableCell>
                </TableRow>
                {balanco1.ativos.naoCirculantes.criptoativos > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Bitcoin className="w-3 h-3 text-gold" />
                      Criptoativos (Voláteis)
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(balanco1.ativos.naoCirculantes.criptoativos)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.ativos.naoCirculantes.criptoativos / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                {balanco1.ativos.naoCirculantes.stablecoins > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      Stablecoins
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(balanco1.ativos.naoCirculantes.stablecoins)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.ativos.naoCirculantes.stablecoins / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                {balanco1.ativos.naoCirculantes.objetivos > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Target className="w-3 h-3 text-accent" />
                      Objetivos Financeiros
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(balanco1.ativos.naoCirculantes.objetivos)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.ativos.naoCirculantes.objetivos / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                {balanco1.ativos.naoCirculantes.veiculos > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Car className="w-3 h-3 text-warning" />
                      Imobilizado (Veículos)
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(balanco1.ativos.naoCirculantes.veiculos)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.ativos.naoCirculantes.veiculos / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="border-border bg-success/10">
                  <TableCell className="font-bold text-success">TOTAL DO ATIVO</TableCell>
                  <TableCell className="text-right font-bold text-success text-lg">{formatCurrency(balanco1.ativos.total)}</TableCell>
                  <TableCell className="text-right font-bold text-success">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ExpandablePanel>

        <ExpandablePanel
          title="PASSIVO + PL"
          subtitle="Obrigações e capital próprio"
          icon={<CreditCard className="w-4 h-4" />}
          badge={formatCurrency(balanco1.ativos.total)}
          badgeStatus={balanco1.patrimonioLiquido >= 0 ? "success" : "danger"}
          defaultExpanded={true}
        >
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/30">
                  <TableHead className="text-muted-foreground">Conta</TableHead>
                  <TableHead className="text-muted-foreground text-right">Valor</TableHead>
                  <TableHead className="text-muted-foreground text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-border bg-warning/5">
                  <TableCell colSpan={3} className="font-semibold text-warning text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      PASSIVO CIRCULANTE (Vencimento em 12 meses)
                    </div>
                  </TableCell>
                </TableRow>
                
                {balanco1.passivos.saldoDevedorCartoes > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <CreditCard className="w-3 h-3 text-warning" />
                      Saldo Devedor Cartões
                    </TableCell>
                    <TableCell className="text-right font-medium text-warning">
                      {formatCurrency(balanco1.passivos.saldoDevedorCartoes)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.saldoDevedorCartoes / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                
                {balanco1.passivos.loanPrincipalShortTerm > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-warning" />
                      Principal Empréstimos (12 meses)
                    </TableCell>
                    <TableCell className="text-right font-medium text-warning">
                      {formatCurrency(balanco1.passivos.loanPrincipalShortTerm)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.loanPrincipalShortTerm / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                
                {balanco1.passivos.segurosAPagarShortTerm > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Shield className="w-3 h-3 text-warning" />
                      Seguros a Pagar (12 meses)
                    </TableCell>
                    <TableCell className="text-right font-medium text-warning">
                      {formatCurrency(balanco1.passivos.segurosAPagarShortTerm)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.segurosAPagarShortTerm / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                
                <TableRow className="border-border bg-muted/20">
                  <TableCell className="font-medium text-foreground pl-4">Subtotal Circulante</TableCell>
                  <TableCell className="text-right font-semibold text-warning">{formatCurrency(balanco1.passivos.curtoPrazo)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.curtoPrazo / balanco1.ativos.total) * 100) : "0%"}
                  </TableCell>
                </TableRow>

                <TableRow className="border-border bg-destructive/5">
                  <TableCell colSpan={3} className="font-semibold text-destructive text-sm">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      PASSIVO NÃO CIRCULANTE (Vencimento &gt; 12 meses)
                    </div>
                  </TableCell>
                </TableRow>
                
                {balanco1.passivos.loanPrincipalLongTerm > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6">Principal Empréstimos (Longo Prazo)</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(balanco1.passivos.loanPrincipalLongTerm)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.loanPrincipalLongTerm / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                
                {balanco1.passivos.segurosAPagarLongoPrazo > 0 && (
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="pl-6 flex items-center gap-2">
                      <Shield className="w-3 h-3 text-destructive" />
                      Seguros a Pagar (Longo Prazo)
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(balanco1.passivos.segurosAPagarLongoPrazo)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.segurosAPagarLongoPrazo / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                )}
                
                <TableRow className="border-border bg-muted/20">
                  <TableCell className="font-medium text-foreground pl-4">Subtotal Longo Prazo</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{formatCurrency(balanco1.passivos.longoPrazo)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.longoPrazo / balanco1.ativos.total) * 100) : "0%"}
                  </TableCell>
                </TableRow>

                <TableRow className="border-border bg-destructive/10">
                  <TableCell className="font-bold text-destructive">TOTAL DO PASSIVO</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{formatCurrency(balanco1.passivos.total)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {balanco1.ativos.total > 0 ? formatPercent((balanco1.passivos.total / balanco1.ativos.total) * 100) : "0%"}
                  </TableCell>
                </TableRow>

                <TableRow className="border-border bg-primary/5">
                  <TableCell colSpan={3} className="font-semibold text-primary text-sm">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      PATRIMÔNIO LÍQUIDO
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="border-border hover:bg-muted/20">
                  <TableCell className="pl-6">Capital Próprio (Ativos - Passivos)</TableCell>
                  <TableCell className={cn("text-right font-medium", balanco1.patrimonioLiquido >= 0 ? "text-success" : "text-destructive")}>
                    {formatCurrency(balanco1.patrimonioLiquido)}
                  </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {balanco1.ativos.total > 0 ? formatPercent((balanco1.patrimonioLiquido / balanco1.ativos.total) * 100) : "0%"}
                    </TableCell>
                  </TableRow>

                <TableRow className="border-border bg-primary/10">
                  <TableCell className="font-bold text-primary">TOTAL PASSIVO + PL</TableCell>
                  <TableCell className="text-right font-bold text-primary text-lg">{formatCurrency(balanco1.ativos.total)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ExpandablePanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel
          title="Composição dos Ativos"
          subtitle="Distribuição por classe"
          icon={<PieChart className="w-4 h-4" />}
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={composicaoAtivos.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={CustomPieLabel}
                  labelLine
                >
                  {composicaoAtivos.filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Valor"]}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </ExpandablePanel>

        <ExpandablePanel
          title="Evolução Patrimonial"
          subtitle="Últimos 12 meses"
          icon={<LineChart className="w-4 h-4" />}
          badge={getTrend(variacoes.patrimonioLiquido || 0) === "up" ? "Crescendo" : "Reduzindo"}
          badgeStatus={getTrend(variacoes.patrimonioLiquido || 0) === "up" ? "success" : "danger"}
        >
          <EvolucaoPatrimonialChart />
        </ExpandablePanel>
      </div>

      <ExpandablePanel
        title="Indicadores Patrimoniais"
        subtitle="Métricas de saúde financeira"
        icon={<Landmark className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailedIndicatorBadge
            title="PL / Total de Ativos"
            value={formatPercent(metricas.plAtivos.valor)}
            status={metricas.plAtivos.status}
            trend={getTrend(variacoes.patrimonioLiquido || 0)}
            trendLabel={range2.from ? `${(variacoes.patrimonioLiquido || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Indica quanto do patrimônio é efetivamente seu. Ideal: acima de 50%"
            formula="(Patrimônio Líquido / Ativo Total) × 100"
            sparklineData={generateSparkline(metricas.plAtivos.valor, getTrend(variacoes.patrimonioLiquido || 0))}
            icon={<Scale className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Liquidez Geral"
            value={formatRatio(metricas.liquidezGeral.valor)}
            status={metricas.liquidezGeral.status}
            trend={getTrend(variacoes.ativosTotal || 0)}
            trendLabel={range2.from ? `${(variacoes.ativosTotal || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Capacidade de pagar todas as dívidas. Ideal: acima de 2x"
            formula="Ativo Total / Passivo Total"
            sparklineData={generateSparkline(metricas.liquidezGeral.valor, getTrend(variacoes.ativosTotal || 0))}
            icon={<Droplets className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Liquidez Corrente"
            value={formatRatio(metricas.liquidezCorrente.valor)}
            status={metricas.liquidezCorrente.status}
            trend={getTrend(variacoes.circulantes || 0)}
            trendLabel={range2.from ? `${(variacoes.circulantes || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Capacidade de pagar dívidas de curto prazo. Ideal: acima de 1.5x"
            formula="Ativo Circulante / Passivo Circulante (12 meses)"
            sparklineData={generateSparkline(metricas.liquidezCorrente.valor, getTrend(variacoes.circulantes || 0))}
            icon={<Banknote className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Endividamento"
            value={formatPercent(metricas.endividamento.valor)}
            status={metricas.endividamento.status}
            trend={getTrend(variacoes.passivosTotal || 0, true)}
            trendLabel={range2.from ? `${(variacoes.passivosTotal || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Percentual dos ativos comprometidos com dívidas. Quanto menor, melhor. Ideal: abaixo de 30%"
            formula="(Passivo Total / Ativo Total) × 100"
            sparklineData={generateSparkline(metricas.endividamento.valor, getTrend(variacoes.passivosTotal || 0, true))}
            icon={<CreditCard className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Cobertura de Ativos"
            value={formatRatio(metricas.coberturaAtivos.valor)}
            status={metricas.coberturaAtivos.status}
            trend={getTrend(variacoes.ativosTotal || 0)}
            trendLabel={range2.from ? `${(variacoes.ativosTotal || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Quantas vezes os ativos cobrem os passivos. Ideal: acima de 2x"
            formula="Ativo Total / Passivo Total"
            sparklineData={generateSparkline(metricas.coberturaAtivos.valor, getTrend(variacoes.ativosTotal || 0))}
            icon={<ShieldCheck className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Imobilização do PL"
            value={formatPercent(metricas.imobilizacao.valor)}
            status={metricas.imobilizacao.status}
            trend={getTrend(variacoes.patrimonioLiquido || 0, true)}
            trendLabel={range2.from ? `${(variacoes.patrimonioLiquido || 0).toFixed(1)}% vs anterior` : undefined}
            descricao="Quanto do patrimônio está investido em bens imobilizados (veículos). Ideal: abaixo de 30%"
            formula="(Ativo Imobilizado / Patrimônio Líquido) × 100"
            sparklineData={generateSparkline(metricas.imobilizacao.valor, getTrend(variacoes.patrimonioLiquido || 0, true))}
            icon={<Car className="w-4 h-4" />}
          />
        </div>
      </ExpandablePanel>
    </div>
  );
}