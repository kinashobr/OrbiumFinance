import { useMemo, useState } from "react";
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
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
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
import { IndicatorBadge } from "./IndicatorBadge";
import { DetailedIndicatorBadge } from "./DetailedIndicatorBadge";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "../dashboard/PeriodSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = {
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 72%, 51%)",
  primary: "hsl(199, 89%, 48%)",
  accent: "hsl(270, 80%, 60%)",
  muted: "hsl(215, 20%, 55%)",
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

interface DREItemProps {
  label: string;
  value: number;
  type: "receita" | "despesa" | "resultado" | "subtotal";
  level?: number;
  icon?: React.ReactNode;
  subItems?: { label: string; value: number }[];
}

function DREItem({ label, value, type, level = 0, icon, subItems }: DREItemProps) {
  const formatCurrency = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const styles = {
    receita: "text-success",
    despesa: "text-destructive",
    resultado: value >= 0 ? "text-success font-bold" : "text-destructive font-bold",
    subtotal: value >= 0 ? "text-primary font-semibold" : "text-warning font-semibold",
  };

  const bgStyles = {
    receita: "",
    despesa: "",
    resultado: "bg-muted/30 rounded-lg",
    subtotal: "bg-muted/20 rounded-lg",
  };

  const prefix = type === "despesa" ? "(-) " : type === "resultado" && value < 0 ? "(-) " : "";

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between py-2.5 px-3 border-b border-border/30 last:border-0",
          bgStyles[type]
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={cn(
            "text-sm",
            type === "resultado" || type === "subtotal" ? "font-semibold" : "text-muted-foreground"
          )}>
            {prefix}{label}
          </span>
        </div>
        <span className={cn("text-sm tabular-nums", styles[type])}>
          {value < 0 ? "-" : ""}{formatCurrency(value)}
        </span>
      </div>
      {subItems && subItems.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between py-1.5 px-3 border-b border-border/20"
          style={{ paddingLeft: `${28 + level * 16}px` }}
        >
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className={cn("text-xs tabular-nums", type === "receita" ? "text-success/80" : "text-destructive/80")}>
            {formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </>
  );
}

// Define o tipo de status esperado pelos componentes ReportCard e IndicatorBadge
type KPIStatus = "success" | "warning" | "danger" | "neutral";

interface DRETabProps {
  dateRange: DateRange;
}

export function DRETab({ dateRange }: DRETabProps) {
  const {
    transacoesV2,
    categoriasV2,
    emprestimos,
    getJurosTotais,
  } = useFinance();

  const [periodo, setPeriodo] = useState<"mensal" | "trimestral" | "anual">("anual");

  // 1. Filtrar transações para o período selecionado
  const transacoesPeriodo = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return transacoesV2;
    
    return transacoesV2.filter(t => {
      try {
        const dataT = parseISO(t.date);
        return isWithinInterval(dataT, { start: dateRange.from!, end: dateRange.to! });
      } catch {
        return false;
      }
    });
  }, [transacoesV2, dateRange]);

  // Cálculos da DRE
  const dre = useMemo(() => {
    const now = new Date();
    
    // Mapear categorias por ID
    const categoriasMap = new Map(categoriasV2.map(c => [c.id, c]));

    // Agrupar receitas por categoria
    const receitasPorCategoria: { categoria: string; valor: number; natureza: string }[] = [];
    const transacoesReceita = transacoesPeriodo.filter(t => 
      t.flow === 'in' && 
      t.operationType !== 'transferencia' &&
      t.operationType !== 'liberacao_emprestimo'
    );

    const receitasAgrupadas = new Map<string, number>();
    transacoesReceita.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '') || { label: 'Outras Receitas', nature: 'receita' };
      const key = cat.label;
      receitasAgrupadas.set(key, (receitasAgrupadas.get(key) || 0) + t.amount);
    });
    receitasAgrupadas.forEach((valor, categoria) => {
      receitasPorCategoria.push({ categoria, valor, natureza: 'receita' });
    });

    // Agrupar despesas por categoria e natureza
    const despesasFixas: { categoria: string; valor: number }[] = [];
    const despesasVariaveis: { categoria: string; valor: number }[] = [];
    
    const transacoesDespesa = transacoesPeriodo.filter(t => 
      t.flow === 'out' && 
      t.operationType !== 'transferencia' &&
      t.operationType !== 'aplicacao'
    );

    const despesasFixasMap = new Map<string, number>();
    const despesasVariaveisMap = new Map<string, number>();

    transacoesDespesa.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      const catLabel = cat?.label || 'Outras Despesas';
      const nature = cat?.nature || 'despesa_variavel';

      if (nature === 'despesa_fixa') {
        despesasFixasMap.set(catLabel, (despesasFixasMap.get(catLabel) || 0) + t.amount);
      } else {
        despesasVariaveisMap.set(catLabel, (despesasVariaveisMap.get(catLabel) || 0) + t.amount);
      }
    });

    despesasFixasMap.forEach((valor, categoria) => {
      despesasFixas.push({ categoria, valor });
    });
    despesasVariaveisMap.forEach((valor, categoria) => {
      despesasVariaveis.push({ categoria, valor });
    });

    // Ordenar por valor
    receitasPorCategoria.sort((a, b) => b.valor - a.valor);
    despesasFixas.sort((a, b) => b.valor - a.valor);
    despesasVariaveis.sort((a, b) => b.valor - a.valor);

    // Totais
    const totalReceitas = receitasPorCategoria.reduce((acc, r) => acc + r.valor, 0);
    const totalDespesasFixas = despesasFixas.reduce((acc, d) => acc + d.valor, 0);
    const totalDespesasVariaveis = despesasVariaveis.reduce((acc, d) => acc + d.valor, 0);
    const totalDespesas = totalDespesasFixas + totalDespesasVariaveis;

    // Juros de empréstimos (passivo financeiro)
    const jurosEmprestimos = getJurosTotais();

    // Resultados
    const resultadoBruto = totalReceitas - totalDespesasFixas;
    const resultadoOperacional = resultadoBruto - totalDespesasVariaveis;
    const resultadoAntesJuros = resultadoOperacional;
    const resultadoLiquido = resultadoOperacional - jurosEmprestimos;

    // Evolução mensal (últimos 12 meses)
    const evolucaoMensal: { mes: string; receitas: number; despesas: number; resultado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const data = subMonths(now, i);
      const inicio = startOfMonth(data);
      const fim = endOfMonth(data);
      const mesLabel = format(data, 'MMM', { locale: ptBR });

      const transacoesMes = transacoesV2.filter(t => {
        try {
          const dataT = parseISO(t.date);
          return isWithinInterval(dataT, { start: inicio, end: fim });
        } catch {
          return false;
        }
      });

      const receitasMes = transacoesMes
        .filter(t => t.flow === 'in' && t.operationType !== 'transferencia' && t.operationType !== 'liberacao_emprestimo')
        .reduce((acc, t) => acc + t.amount, 0);
      const despesasMes = transacoesMes
        .filter(t => t.flow === 'out' && t.operationType !== 'transferencia' && t.operationType !== 'aplicacao')
        .reduce((acc, t) => acc + t.amount, 0);

      evolucaoMensal.push({
        mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
        receitas: receitasMes,
        despesas: despesasMes,
        resultado: receitasMes - despesasMes,
      });
    }

    // Composição das despesas para gráfico pizza
    const composicaoDespesas = [
      { name: "Despesas Fixas", value: totalDespesasFixas, color: COLORS.danger },
      { name: "Despesas Variáveis", value: totalDespesasVariaveis, color: COLORS.warning },
      { name: "Juros e Encargos", value: jurosEmprestimos, color: COLORS.accent },
    ].filter(item => item.value > 0);

    // Métricas de Rentabilidade (recalculadas aqui para o período)
    const margemBruta = totalReceitas > 0 ? (resultadoBruto / totalReceitas) * 100 : 0;
    const margemOperacional = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0;
    const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

    return {
      totalReceitas,
      totalDespesas,
      resultadoLiquido,
      resultadoBruto,
      resultadoOperacional,
      jurosEmprestimos,
      receitasPorCategoria,
      despesasFixas,
      despesasVariaveis,
      evolucaoMensal,
      composicaoDespesas,
      margemBruta,
      margemOperacional,
      margemLiquida,
    };
  }, [transacoesPeriodo, categoriasV2, transacoesV2, getJurosTotais]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const getStatus = (value: number): KPIStatus => {
    if (value > 0) return "success";
    if (value < 0) return "danger";
    return "neutral";
  };

  return (
    <div className="space-y-6">
      {/* Cards Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Receita Total"
          value={formatCurrency(dre.totalReceitas)}
          status="success"
          icon={<TrendingUp className="w-5 h-5" />}
          tooltip="Soma de todas as entradas (exceto transferências e empréstimos)"
          delay={0}
        />
        <ReportCard
          title="Despesa Total"
          value={formatCurrency(dre.totalDespesas)}
          status="danger"
          icon={<TrendingDown className="w-5 h-5" />}
          tooltip="Soma de todas as saídas (exceto transferências e aplicações)"
          delay={50}
        />
        <ReportCard
          title="Resultado Líquido"
          value={formatCurrency(dre.resultadoLiquido)}
          status={getStatus(dre.resultadoLiquido)}
          icon={<DollarSign className="w-5 h-5" />}
          tooltip="Receita Total - Despesa Total - Juros"
          delay={100}
        />
        <ReportCard
          title="Margem Líquida"
          value={formatPercent(dre.margemLiquida)}
          status={dre.margemLiquida >= 10 ? "success" : dre.margemLiquida >= 0 ? "warning" : "danger"}
          icon={<Percent className="w-5 h-5" />}
          tooltip="Percentual da receita que se transforma em resultado líquido"
          delay={150}
        />
      </div>

      {/* DRE Estruturada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE Detalhada */}
        <ExpandablePanel
          title="Demonstração do Resultado"
          subtitle={`Período: ${format(dateRange.from || now, 'dd/MM/yyyy')} a ${format(dateRange.to || now, 'dd/MM/yyyy')}`}
          icon={<Receipt className="w-4 h-4" />}
          badge={formatCurrency(dre.resultadoLiquido)}
          badgeStatus={getStatus(dre.resultadoLiquido)}
          defaultExpanded={true}
        >
          <div className="glass-card p-0">
            {/* Receitas */}
            <DREItem label="RECEITA BRUTA" value={dre.totalReceitas} type="receita" icon={<Plus className="w-4 h-4" />} />
            {dre.receitasPorCategoria.map((r, index) => (
              <DREItem key={index} label={r.categoria} value={r.valor} type="receita" level={1} />
            ))}

            {/* Despesas Fixas */}
            <DREItem label="(-) DESPESAS FIXAS" value={dre.totalDespesasFixas} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre.despesasFixas.map((d, index) => (
              <DREItem key={index} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            {/* Resultado Bruto */}
            <DREItem label="RESULTADO BRUTO" value={dre.resultadoBruto} type="subtotal" icon={<Equal className="w-4 h-4" />} />

            {/* Despesas Variáveis */}
            <DREItem label="(-) DESPESAS VARIÁVEIS" value={dre.totalDespesasVariaveis} type="despesa" icon={<Minus className="w-4 h-4" />} />
            {dre.despesasVariaveis.map((d, index) => (
              <DREItem key={index} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            {/* Resultado Operacional */}
            <DREItem label="RESULTADO OPERACIONAL" value={dre.resultadoOperacional} type="subtotal" icon={<Equal className="w-4 h-4" />} />

            {/* Juros e Encargos */}
            <DREItem label="(-) JUROS E ENCARGOS" value={dre.jurosEmprestimos} type="despesa" icon={<CreditCard className="w-4 h-4" />} />
            <DREItem label="Juros de Empréstimos" value={dre.jurosEmprestimos} type="despesa" level={1} />

            {/* Resultado Líquido */}
            <DREItem label="RESULTADO LÍQUIDO" value={dre.resultadoLiquido} type="resultado" icon={<DollarSign className="w-4 h-4" />} />
          </div>
        </ExpandablePanel>

        {/* Gráficos DRE */}
        <div className="space-y-6">
          {/* Evolução Mensal */}
          <ExpandablePanel
            title="Evolução do Resultado"
            subtitle="Últimos 12 meses"
            icon={<BarChart3 className="w-4 h-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dre.evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.muted, fontSize: 11 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: COLORS.primary, fontSize: 11 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill={COLORS.success} opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="despesas" name="Despesas" fill={COLORS.danger} opacity={0.7} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="resultado" name="Resultado" stroke={COLORS.primary} strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ExpandablePanel>

          {/* Composição das Despesas */}
          <ExpandablePanel
            title="Composição das Despesas"
            subtitle="Distribuição por tipo"
            icon={<PieChart className="w-4 h-4" />}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={dre.composicaoDespesas}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: COLORS.muted, strokeWidth: 1 }}
                  >
                    {dre.composicaoDespesas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
        </div>
      </div>
    </div>
  );
}