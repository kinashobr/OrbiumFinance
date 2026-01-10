import { useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Calculator,
  BarChart3,
  PieChart,
  Minus,
  Plus,
  Equal,
  Percent,
} from "lucide-react";
import {
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
  Bar,
} from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
import { cn, parseDateLocal } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComparisonDateRanges, DateRange } from "@/types/finance";
import { TransacaoCompleta } from "@/types/finance";

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

interface DRETabProps {
  dateRanges: ComparisonDateRanges;
}

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
  
  const paddingClass = level === 1 ? "pl-8" : level === 2 ? "pl-12" : "pl-4";

  return (
    <div className={cn(baseClasses, typeClasses[type], paddingClass)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={cn("text-sm", type === 'resultado' && "text-base")}>{label}</span>
      </div>
      <span className={cn(
        "font-medium whitespace-nowrap",
        type === 'resultado' && "text-xl"
      )}>
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

export function DRETab({ dateRanges }: DRETabProps) {
  const {
    transacoesV2,
    categoriasV2,
    emprestimos,
    calculateLoanSchedule,
  } = useFinance();

  const { range1, range2 } = dateRanges;
  const now = new Date();

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

  const calculateDRE = useCallback((transactions: TransacaoCompleta[]) => {
    const categoriasMap = new Map(categoriasV2.map(c => [c.id, c]));

    const transacoesReceitaBruta = transactions.filter(t => 
      t.operationType === 'receita'
    );

    const receitasBrutasAgrupadas = new Map<string, number>();
    transacoesReceitaBruta.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      if (cat) {
        receitasBrutasAgrupadas.set(cat.label, (receitasBrutasAgrupadas.get(cat.label) || 0) + t.amount);
      }
    });

    const receitasBrutas: { categoria: string; valor: number }[] = [];
    receitasBrutasAgrupadas.forEach((valor, categoria) => {
      receitasBrutas.push({ categoria, valor });
    });
    receitasBrutas.sort((a, b) => b.valor - a.valor);
    const totalReceitaBruta = receitasBrutas.reduce((acc, r) => acc + r.valor, 0);

    const despesasFixas: { categoria: string; valor: number }[] = [];
    const despesasVariaveis: { categoria: string; valor: number }[] = [];
    
    const transacoesDespesaOperacional = transactions.filter(t => 
      t.operationType !== 'initial_balance' && 
      t.operationType !== 'veiculo' && 
      t.operationType !== 'pagamento_emprestimo' &&
      t.flow === 'out'
    );

    const despesasFixasMap = new Map<string, number>();
    const despesasVariaveisMap = new Map<string, number>();

    transacoesDespesaOperacional.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      if (cat) {
        if (cat.nature === 'despesa_fixa') {
          despesasFixasMap.set(cat.label, (despesasFixasMap.get(cat.label) || 0) + t.amount);
        } else {
          despesasVariaveisMap.set(cat.label, (despesasVariaveisMap.get(cat.label) || 0) + t.amount);
        }
      }
    });
    
    despesasFixasMap.forEach((valor, categoria) => despesasFixas.push({ categoria, valor }));
    despesasVariaveisMap.forEach((valor, categoria) => despesasVariaveis.push({ categoria, valor }));
    despesasFixas.sort((a, b) => b.valor - a.valor);
    despesasVariaveis.sort((a, b) => b.valor - a.valor);

    const totalDespesasFixas = despesasFixas.reduce((acc, d) => acc + d.valor, 0);
    const totalDespesasVariaveis = despesasVariaveis.reduce((acc, d) => acc + d.valor, 0);

    const resultadoBruto = totalReceitaBruta - totalDespesasFixas;
    const resultadoOperacional = resultadoBruto - totalDespesasVariaveis;

    const totalRendimentos = transactions
      .filter(t => t.operationType === 'rendimento')
      .reduce((acc, t) => acc + t.amount, 0);

    let jurosEmprestimos = 0;
    transactions.filter(t => t.operationType === 'pagamento_emprestimo').forEach(t => {
        const loanIdStr = t.links?.loanId?.replace('loan_', '');
        const parcelaIdStr = t.links?.parcelaId;
        if (loanIdStr && parcelaIdStr) {
            const loanId = parseInt(loanIdStr);
            const parcelaNumber = parseInt(parcelaIdStr);
            if (!isNaN(loanId) && !isNaN(parcelaNumber)) {
                const schedule = calculateLoanSchedule(loanId);
                const item = schedule.find(i => i.parcela === parcelaNumber);
                if (item) jurosEmprestimos += item.juros;
            }
        }
    });

    const resultadoFinanceiro = totalRendimentos - jurosEmprestimos;
    const resultadoLiquido = resultadoOperacional + resultadoFinanceiro;

    const composicaoDespesas = [
      { name: "Despesas Fixas", value: totalDespesasFixas, color: COLORS.danger },
      { name: "Despesas Variáveis", value: totalDespesasVariaveis, color: COLORS.warning },
      { name: "Juros e Encargos", value: jurosEmprestimos, color: COLORS.accent },
    ].filter(item => item.value > 0);

    return {
      totalReceitaBruta,
      totalDespesas: totalDespesasFixas + totalDespesasVariaveis + jurosEmprestimos,
      resultadoLiquido,
      resultadoBruto,
      resultadoOperacional,
      totalRendimentos,
      jurosEmprestimos,
      resultadoFinanceiro,
      receitasBrutas,
      despesasFixas,
      despesasVariaveis,
      composicaoDespesas,
      totalDespesasFixas,
      totalDespesasVariaveis,
    };
  }, [categoriasV2, emprestimos, calculateLoanSchedule]);

  const dre1 = useMemo(() => calculateDRE(transacoesPeriodo1), [calculateDRE, transacoesPeriodo1]);
  const dre2 = useMemo(() => calculateDRE(transacoesPeriodo2), [calculateDRE, transacoesPeriodo2]);

  const variacaoRL = useMemo(() => {
    if (!range2.from) return { diff: 0, percent: 0 };
    const diff = dre1.resultadoLiquido - dre2.resultadoLiquido;
    const percent = dre2.resultadoLiquido !== 0 ? (diff / Math.abs(dre2.resultadoLiquido)) * 100 : 0;
    return { diff, percent };
  }, [dre1, dre2, range2.from]);

  const evolucaoMensal = useMemo(() => {
    const resultado: { mes: string; receitas: number; despesas: number; resultado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const data = subMonths(now, i);
      const inicio = startOfMonth(data);
      const fim = endOfMonth(data);
      const mesLabel = format(data, 'MMM', { locale: ptBR });

      const transacoesMes = transacoesV2.filter(t => {
        try {
          const dataT = parseDateLocal(t.date);
          return isWithinInterval(dataT, { start: inicio, end: fim });
        } catch { return false; }
      });

      const receitasMes = transacoesMes
        .filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento'))
        .reduce((acc, t) => acc + t.amount, 0);
      
      const despesasMes = transacoesMes
        .filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo' || t.operationType === 'veiculo'))
        .reduce((acc, t) => acc + t.amount, 0);

      resultado.push({
        mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
        receitas: receitasMes,
        despesas: despesasMes,
        resultado: receitasMes - despesasMes,
      });
    }
    return resultado;
  }, [transacoesV2, now]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Receita Bruta"
          value={formatCurrency(dre1.totalReceitaBruta)}
          status="success"
          icon={<TrendingUp className="w-5 h-5" />}
          tooltip="Soma das receitas operacionais (salário, vendas, etc)"
          delay={0}
        />
        <ReportCard
          title="Despesa Operacional"
          value={formatCurrency(dre1.totalDespesasFixas + dre1.totalDespesasVariaveis)}
          status="danger"
          icon={<TrendingDown className="w-5 h-5" />}
          tooltip="Soma das despesas fixas e variáveis"
          delay={50}
        />
        <ReportCard
          title="Resultado Líquido"
          value={formatCurrency(dre1.resultadoLiquido)}
          status={dre1.resultadoLiquido > 0 ? "success" : "danger"}
          icon={<DollarSign className="w-5 h-5" />}
          tooltip="Resultado final após receitas financeiras e juros"
          delay={100}
        />
        <ReportCard
          title="Variação do RL"
          value={`${variacaoRL.percent.toFixed(1)}%`}
          trend={variacaoRL.percent}
          trendLabel="anterior"
          status={variacaoRL.percent >= 0 ? "success" : "danger"}
          icon={<Percent className="w-5 h-5" />}
          tooltip={`Variação do Resultado Líquido vs período anterior`}
          delay={150}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel
          title="Demonstração do Resultado"
          subtitle="Estrutura Contábil"
          icon={<Receipt className="w-4 h-4" />}
          badge={formatCurrency(dre1.resultadoLiquido)}
          badgeStatus={dre1.resultadoLiquido > 0 ? "success" : "danger"}
          defaultExpanded={true}
        >
          <div className="glass-card p-0">
            <DREItem label="RECEITA BRUTA" value={dre1.totalReceitaBruta} type="receita" icon={<Plus className="w-4 h-4" />} />
            {dre1.receitasBrutas.map((r, i) => (
              <DREItem key={i} label={r.categoria} value={r.valor} type="receita" level={1} />
            ))}

            <DREItem label="(-) DESPESAS FIXAS" value={dre1.totalDespesasFixas} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre1.despesasFixas.map((d, i) => (
              <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            <DREItem label="RESULTADO BRUTO" value={dre1.resultadoBruto} type="subtotal" icon={<Equal className="w-4 h-4" />} />

            <DREItem label="(-) DESPESAS VARIÁVEIS" value={dre1.totalDespesasVariaveis} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre1.despesasVariaveis.map((d, i) => (
              <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            <DREItem label="RESULTADO OPERACIONAL" value={dre1.resultadoOperacional} type="subtotal" icon={<Equal className="w-4 h-4" />} />

            <DREItem label="(+/-) RESULTADO FINANCEIRO" value={dre1.resultadoFinanceiro} type="subtotal" icon={<Calculator className="w-4 h-4" />} />
            <DREItem label="(+) Rendimentos de Investimentos" value={dre1.totalRendimentos} type="receita" level={1} />
            <DREItem label="(-) Juros de Empréstimos" value={dre1.jurosEmprestimos} type="despesa" level={1} />

            <DREItem label="RESULTADO LÍQUIDO" value={dre1.resultadoLiquido} type="resultado" icon={<DollarSign className="w-4 h-4" />} />
          </div>
        </ExpandablePanel>

        <div className="space-y-6">
          <ExpandablePanel
            title="Evolução do Resultado"
            subtitle="Últimos 12 meses"
            icon={<BarChart3 className="w-4 h-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 18%)" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: COLORS.primary, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill={COLORS.success} opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="despesas" name="Despesas" fill={COLORS.danger} opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="resultado" name="Resultado" stroke={COLORS.primary} strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>

          <ExpandablePanel
            title="Composição das Despesas"
            subtitle="Distribuição por tipo"
            icon={<PieChart className="w-4 h-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={dre1.composicaoDespesas}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={CustomPieLabel}
                    labelLine
                  >
                    {dre1.composicaoDespesas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>
        </div>
      </div>
    </div>
  );
}