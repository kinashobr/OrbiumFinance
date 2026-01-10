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
  ArrowRight,
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
} from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
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
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, addMonths, isBefore, isAfter, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComparisonDateRanges, DateRange } from "@/types/finance";
import { EvolucaoPatrimonialChart } from "@/components/dashboard/EvolucaoPatrimonialChart";
import { Badge } from "@/components/ui/badge";

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
      fontSize={10}
      fontWeight="bold"
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
    segurosVeiculo,
    getAtivosTotal,
    getPassivosTotal,
    calculateBalanceUpToDate,
    getValorFipeTotal,
    getSegurosAApropriar,
    getSegurosAPagar,
    calculateLoanPrincipalDueInNextMonths,
    calculateLoanSchedule,
    calculatePaidInstallmentsUpToDate,
    getLoanPrincipalRemaining,
    getCreditCardDebt,
  } = useFinance();

  const { range1, range2 } = dateRanges;

  const calculateFinalBalances = useCallback((periodEnd: Date | undefined) => {
    const saldos: Record<string, number> = {};
    contasMovimento.forEach(conta => {
      saldos[conta.id] = calculateBalanceUpToDate(conta.id, periodEnd, transacoesV2, contasMovimento);
    });
    return saldos;
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate]);

  const calculatePercentChange = useCallback((value1: number, value2: number) => {
    if (value2 === 0) return 0;
    return ((value1 - value2) / Math.abs(value2)) * 100;
  }, []);

  const calculateBalanco = useCallback((range: DateRange) => {
    const targetDate = range.to;
    const finalDate = targetDate || new Date(9999, 11, 31);

    const saldosPorConta = calculateFinalBalances(finalDate);
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
        saldoDevedorCartoes,
        loanPrincipalShortTerm,
        loanPrincipalLongTerm,
        segurosAPagarShortTerm,
        segurosAPagarLongoPrazo,
      },
      patrimonioLiquido,
    };
  }, [contasMovimento, transacoesV2, segurosVeiculo, calculateFinalBalances, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getCreditCardDebt, getLoanPrincipalRemaining]);

  const balanco1 = useMemo(() => calculateBalanco(range1), [calculateBalanco, range1]);
  const balanco2 = useMemo(() => calculateBalanco(range2), [calculateBalanco, range2]);

  const variacoes = useMemo(() => {
    if (!range2.from) return {};
    return {
      ativosTotal: calculatePercentChange(balanco1.ativos.total, balanco2.ativos.total),
      passivosTotal: calculatePercentChange(balanco1.passivos.total, balanco2.passivos.total),
      patrimonioLiquido: calculatePercentChange(balanco1.patrimonioLiquido, balanco2.patrimonioLiquido),
    };
  }, [balanco1, balanco2, range2.from, calculatePercentChange]);

  const composicaoAtivos = useMemo(() => {
    return [
      { name: "Caixa/RF", value: balanco1.ativos.circulantes.caixa, color: COLORS.primary },
      { name: "Seguros", value: balanco1.ativos.circulantes.segurosAApropriar, color: COLORS.cyan },
      { name: "Cripto", value: balanco1.ativos.naoCirculantes.criptoativos, color: COLORS.gold },
      { name: "Objetivos", value: balanco1.ativos.naoCirculantes.objetivos, color: COLORS.accent },
      { name: "Veículos", value: balanco1.ativos.naoCirculantes.veiculos, color: COLORS.warning },
    ].filter(item => item.value > 0);
  }, [balanco1]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-10">
      {/* Cockpit de Riqueza - Cards Expressivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportCard
          title="Total de Ativos"
          value={formatCurrency(balanco1.ativos.total)}
          status="success"
          icon={<TrendingUp className="w-6 h-6" />}
          trend={variacoes.ativosTotal}
          trendLabel={range2.from ? "anterior" : undefined}
          className="rounded-[2.5rem] p-8"
        />
        <ReportCard
          title="Total de Passivos"
          value={formatCurrency(balanco1.passivos.total)}
          status={balanco1.passivos.total > 0 ? "danger" : "success"}
          icon={<TrendingDown className="w-6 h-6" />}
          trend={variacoes.passivosTotal}
          trendLabel={range2.from ? "anterior" : undefined}
          className="rounded-[2.5rem] p-8"
        />
        <ReportCard
          title="Patrimônio Líquido"
          value={formatCurrency(balanco1.patrimonioLiquido)}
          status={balanco1.patrimonioLiquido >= 0 ? "success" : "danger"}
          icon={<Scale className="w-6 h-6" />}
          trend={variacoes.patrimonioLiquido}
          trendLabel={range2.from ? "anterior" : undefined}
          className="rounded-[2.5rem] p-8"
        />
        <div className="bg-surface-light dark:bg-surface-dark rounded-[2.5rem] p-8 border border-white/60 dark:border-white/5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 border-none font-black text-[10px] px-3 py-1 rounded-lg uppercase">Saúde</Badge>
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1">PL / Ativos</p>
            <p className="font-display font-black text-3xl text-foreground">
              {balanco1.ativos.total > 0 ? formatPercent((balanco1.patrimonioLiquido / balanco1.ativos.total) * 100) : "0%"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Painel de Ativos Expressivo */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-2xl text-success shadow-sm">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-black text-2xl text-foreground">Ativos</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Bens e Direitos</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-success/10 text-success border-none px-4 py-1.5 rounded-xl font-black text-sm">
              {formatCurrency(balanco1.ativos.total)}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="px-4 py-2 bg-success/5 rounded-2xl text-[10px] font-black text-success uppercase tracking-widest">Ativo Circulante</div>
            {contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)).map(conta => (
              <div key={conta.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground leading-tight">{conta.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{ACCOUNT_TYPE_LABELS[conta.accountType]}</p>
                  </div>
                </div>
                <p className="font-black text-sm text-success">{formatCurrency(balanco1.saldosPor_conta?.[conta.id] || balanco1.saldosPorConta[conta.id] || 0)}</p>
              </div>
            ))}
            
            <div className="px-4 py-2 bg-primary/5 rounded-2xl text-[10px] font-black text-primary uppercase tracking-widest mt-6">Ativo Não Circulante</div>
            {balanco1.ativos.naoCirculantes.veiculos > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground leading-tight">Imobilizado (Veículos)</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor FIPE</p>
                  </div>
                </div>
                <p className="font-black text-sm text-primary">{formatCurrency(balanco1.ativos.naoCirculantes.veiculos)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Painel de Passivos Expressivo */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-destructive/10 rounded-2xl text-destructive shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-black text-2xl text-foreground">Passivos</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Obrigações</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-none px-4 py-1.5 rounded-xl font-black text-sm">
              {formatCurrency(balanco1.passivos.total)}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="px-4 py-2 bg-warning/5 rounded-2xl text-[10px] font-black text-warning uppercase tracking-widest">Passivo Circulante</div>
            {balanco1.passivos.saldoDevedorCartoes > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground leading-tight">Cartões de Crédito</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Faturas em Aberto</p>
                  </div>
                </div>
                <p className="font-black text-sm text-warning">{formatCurrency(balanco1.passivos.saldoDevedorCartoes)}</p>
              </div>
            )}
            
            <div className="px-4 py-2 bg-destructive/5 rounded-2xl text-[10px] font-black text-destructive uppercase tracking-widest mt-6">Passivo Não Circulante</div>
            {balanco1.passivos.loanPrincipalLongTerm > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground leading-tight">Empréstimos (Longo Prazo)</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Principal Restante</p>
                  </div>
                </div>
                <p className="font-black text-sm text-destructive">{formatCurrency(balanco1.passivos.loanPrincipalLongTerm)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-[3rem] p-10 shadow-soft border border-white/60 dark:border-white/5">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
              <LineChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-2xl text-foreground">Evolução Patrimonial</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Tendência dos Últimos 12 Meses</p>
            </div>
          </div>
          <EvolucaoPatrimonialChart />
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-10 shadow-soft border border-white/60 dark:border-white/5 flex flex-col items-center justify-center">
          <div className="w-full flex items-center gap-4 mb-10">
            <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-sm">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-2xl text-foreground">Distribuição</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Composição de Ativos</p>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={composicaoAtivos}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  label={CustomPieLabel}
                  labelLine={false}
                  stroke="none"
                >
                  {composicaoAtivos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "none", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                  formatter={(v: number) => [formatCurrency(v), "Valor"]}
                />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total</p>
              <p className="text-xl font-black text-foreground">{(balanco1.ativos.total / 1000).toFixed(0)}k</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}