import { useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Plus,
  Minus,
  Equal,
  Percent,
  CreditCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
import { cn, parseDateLocal } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, differenceInMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComparisonDateRanges, DateRange, TransacaoCompleta } from "@/types/finance";

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

const PIE_COLORS = [COLORS.primary, COLORS.accent, COLORS.success, COLORS.warning, COLORS.gold, COLORS.cyan, COLORS.danger];

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface DREItemProps {
  label: string;
  value: number;
  type: 'receita' | 'despesa' | 'subtotal' | 'resultado';
  icon?: React.ReactNode;
  level?: number;
}

function DREItem({ label, value, type, icon, level = 0 }: DREItemProps) {
  const baseClasses = "flex items-center justify-between py-2 px-4 border-b border-border/50";
  const typeClasses = {
    receita: "text-success",
    despesa: "text-destructive",
    subtotal: "font-semibold bg-muted/30 border-t border-b border-border/80",
    resultado: "font-bold text-lg bg-primary/10 border-t-2 border-b-2 border-primary/50",
  };
  
  return (
    <div className={cn(baseClasses, typeClasses[type], level > 0 && `pl-${4 + level * 4}`)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={cn("text-sm", type === 'resultado' && "text-base")}>{label}</span>
      </div>
      <span className={cn("font-medium whitespace-nowrap", type === 'resultado' && "text-xl")}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

const CustomPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.1;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export function DRETab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, categoriasV2, emprestimos, segurosVeiculo, calculateLoanSchedule } = useFinance();
  const { range1, range2 } = dateRanges;

  const calculateDRE = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return null;
    
    const start = startOfDay(range.from);
    const end = endOfDay(range.to);
    const days = differenceInDays(end, start) + 1;

    const transactions = transacoesV2.filter(t => {
      const d = parseDateLocal(t.date);
      return isWithinInterval(d, { start, end });
    });

    const seguroCategory = categoriasV2.find(c => c.label.toLowerCase() === 'seguro');
    const categoriasMap = new Map(categoriasV2.map(c => [c.id, c]));

    let accruedInsurance = 0;
    segurosVeiculo.forEach(s => {
      const vStart = parseDateLocal(s.vigenciaInicio);
      const vEnd = parseDateLocal(s.vigenciaFim);
      const totalDays = differenceInDays(vEnd, vStart) + 1;
      if (totalDays <= 0) return;
      
      const dailyRate = s.valorTotal / totalDays;
      const overlapStart = vStart > start ? vStart : start;
      const overlapEnd = vEnd < end ? vEnd : end;
      
      if (overlapStart <= overlapEnd) {
        const overlapDays = differenceInDays(overlapEnd, overlapStart) + 1;
        accruedInsurance += dailyRate * overlapDays;
      }
    });

    const receitas = transactions.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento');
    const totalReceitas = receitas.reduce((acc, t) => acc + t.amount, 0);

    const despesasFixasMap = new Map<string, number>();
    const despesasVariaveisMap = new Map<string, number>();

    transactions.filter(t => t.operationType === 'despesa' && t.categoryId !== seguroCategory?.id).forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      const label = cat?.label || 'Outros';
      const targetMap = cat?.nature === 'despesa_fixa' ? despesasFixasMap : despesasVariaveisMap;
      targetMap.set(label, (targetMap.get(label) || 0) + t.amount);
    });

    if (accruedInsurance > 0) {
      despesasFixasMap.set('Seguros (Apropriação)', (despesasFixasMap.get('Seguros (Apropriação)') || 0) + accruedInsurance);
    }

    let jurosEmprestimos = 0;
    transactions.filter(t => t.operationType === 'pagamento_emprestimo').forEach(t => {
      const loanId = parseInt(t.links?.loanId?.replace('loan_', '') || '');
      const parcela = parseInt(t.links?.parcelaId || '');
      if (!isNaN(loanId) && !isNaN(parcela)) {
        const item = calculateLoanSchedule(loanId).find(i => i.parcela === parcela);
        if (item) jurosEmprestimos += item.juros;
      }
    });

    const totalFixas = Array.from(despesasFixasMap.values()).reduce((a, b) => a + b, 0);
    const totalVariaveis = Array.from(despesasVariaveisMap.values()).reduce((a, b) => a + b, 0);
    const resultadoLiquido = totalReceitas - totalFixas - totalVariaveis - jurosEmprestimos;

    return {
      totalReceitas,
      totalFixas,
      totalVariaveis,
      jurosEmprestimos,
      resultadoLiquido,
      days,
      receitasAgrupadas: Array.from(receitas.reduce((acc, t) => {
        const label = categoriasMap.get(t.categoryId || '')?.label || 'Outros';
        acc.set(label, (acc.get(label) || 0) + t.amount);
        return acc;
      }, new Map()).entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
      fixasAgrupadas: Array.from(despesasFixasMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
      variaveisAgrupadas: Array.from(despesasVariaveisMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
    };
  }, [transacoesV2, categoriasV2, segurosVeiculo, calculateLoanSchedule]);

  const dre1 = useMemo(() => calculateDRE(range1), [calculateDRE, range1]);
  const dre2 = useMemo(() => calculateDRE(range2), [calculateDRE, range2]);

  const normalizedComparison = useMemo(() => {
    if (!dre1 || !dre2) return { percent: 0, diff: 0 };
    const daily1 = dre1.resultadoLiquido / dre1.days;
    const daily2 = dre2.resultadoLiquido / dre2.days;
    const diff = dre1.resultadoLiquido - (daily2 * dre1.days);
    const percent = daily2 !== 0 ? ((daily1 - daily2) / Math.abs(daily2)) * 100 : 0;
    return { percent, diff };
  }, [dre1, dre2]);

  if (!dre1) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard title="Receita Total" value={formatCurrency(dre1.totalReceitas)} status="success" icon={<TrendingUp className="w-5 h-5" />} delay={0} />
        <ReportCard title="Despesa Operacional" value={formatCurrency(dre1.totalFixas + dre1.totalVariaveis)} status="danger" icon={<TrendingDown className="w-5 h-5" />} delay={50} />
        <ReportCard title="Resultado Líquido" value={formatCurrency(dre1.resultadoLiquido)} status={dre1.resultadoLiquido >= 0 ? "success" : "danger"} icon={<DollarSign className="w-5 h-5" />} delay={100} />
        <ReportCard title="Desempenho vs P2" value={`${normalizedComparison.percent.toFixed(1)}%`} trend={normalizedComparison.percent} trendLabel="Normalizado" status={normalizedComparison.percent >= 0 ? "success" : "danger"} icon={<Percent className="w-5 h-5" />} delay={150} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel title="Demonstração do Resultado" subtitle="Regime de Competência" icon={<Receipt className="w-4 h-4" />} badge={formatCurrency(dre1.resultadoLiquido)} badgeStatus={dre1.resultadoLiquido >= 0 ? "success" : "danger"}>
          <div className="glass-card p-0">
            <DREItem label="RECEITA BRUTA" value={dre1.totalReceitas} type="receita" icon={<Plus className="w-4 h-4" />} />
            {dre1.receitasAgrupadas.map((r, i) => <DREItem key={i} label={r.categoria} value={r.valor} type="receita" level={1} />)}
            <DREItem label="(-) DESPESAS FIXAS" value={dre1.totalFixas} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre1.fixasAgrupadas.map((d, i) => <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />)}
            <DREItem label="(-) DESPESAS VARIÁVEIS" value={dre1.totalVariaveis} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre1.variaveisAgrupadas.map((d, i) => <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />)}
            <DREItem label="(-) CUSTO FINANCEIRO (JUROS)" value={dre1.jurosEmprestimos} type="despesa" icon={<CreditCard className="w-4 h-4" />} />
            <DREItem label="RESULTADO LÍQUIDO" value={dre1.resultadoLiquido} type="resultado" icon={<DollarSign className="w-4 h-4" />} />
          </div>
        </ExpandablePanel>

        <div className="space-y-6">
          <ExpandablePanel title="Composição de Gastos" icon={<RechartsPie className="w-4 h-4" />}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={[{ name: 'Fixas', value: dre1.totalFixas }, { name: 'Variáveis', value: dre1.totalVariaveis }, { name: 'Juros', value: dre1.jurosEmprestimos }].filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={CustomPieLabel}>
                    {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>
        </div>
      </div>
    </div>
  );
}