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
  ArrowUpRight,
  ArrowDownRight,
  Zap,
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
import { cn, parseDateLocal } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComparisonDateRanges, DateRange, TransacaoCompleta } from "@/types/finance";
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

interface DRETabProps {
  dateRanges: ComparisonDateRanges;
}

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface DREItemProps {
  label: string;
  value: number;
  type: 'receita' | 'despesa' | 'subtotal' | 'resultado';
  icon?: React.ReactNode;
  level?: number;
}

function DREItem({ label, value, type, icon, level = 0 }: DREItemProps) {
  const isPositive = type === 'receita' || (type === 'resultado' && value >= 0) || (type === 'subtotal' && value >= 0);
  
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-2xl transition-all group",
      type === 'resultado' ? "bg-primary/10 border-2 border-primary/20 my-4" : 
      type === 'subtotal' ? "bg-muted/30 border border-border/40 my-2" : 
      "hover:bg-muted/20 border-b border-border/20 last:border-0",
      level === 1 && "ml-8",
      level === 2 && "ml-12"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110",
          type === 'receita' ? "bg-success/10 text-success" : 
          type === 'despesa' ? "bg-destructive/10 text-destructive" : 
          "bg-card text-muted-foreground"
        )}>
          {icon || (type === 'receita' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />)}
        </div>
        <div>
          <p className={cn(
            "text-sm font-bold tracking-tight",
            type === 'resultado' ? "text-lg font-black" : "text-foreground"
          )}>{label}</p>
          {type === 'subtotal' && <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Acumulado</p>}
        </div>
      </div>
      <span className={cn(
        "font-black tabular-nums",
        type === 'resultado' ? "text-2xl text-primary" : 
        isPositive ? "text-success" : "text-destructive"
      )}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function DRETab({ dateRanges }: DRETabProps) {
  const {
    transacoesV2,
    categoriasV2,
    calculateLoanSchedule,
  } = useFinance();

  const { range1, range2 } = dateRanges;
  const now = new Date();

  const filterTransactionsByRange = useCallback((range: DateRange) => {
    if (!range.from || !range.to) return transacoesV2;
    return transacoesV2.filter(t => {
      try {
        const dataT = parseDateLocal(t.date);
        return isWithinInterval(dataT, { start: startOfDay(range.from!), end: endOfDay(range.to!) });
      } catch { return false; }
    });
  }, [transacoesV2]);

  const transacoesPeriodo1 = useMemo(() => filterTransactionsByRange(range1), [filterTransactionsByRange, range1]);
  const transacoesPeriodo2 = useMemo(() => filterTransactionsByRange(range2), [filterTransactionsByRange, range2]);

  const calculateDRE = useCallback((transactions: TransacaoCompleta[]) => {
    const categoriasMap = new Map(categoriasV2.map(c => [c.id, c]));
    const transacoesReceitaBruta = transactions.filter(t => t.operationType === 'receita');
    
    const receitasBrutasMap = new Map<string, number>();
    transacoesReceitaBruta.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      if (cat) receitasBrutasMap.set(cat.label, (receitasBrutasMap.get(cat.label) || 0) + t.amount);
    });

    const receitasBrutas = Array.from(receitasBrutasMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    const totalReceitaBruta = receitasBrutas.reduce((acc, r) => acc + r.valor, 0);

    const transacoesDespesaOperacional = transactions.filter(t => t.operationType !== 'initial_balance' && t.operationType !== 'veiculo' && t.operationType !== 'pagamento_emprestimo' && t.flow === 'out');
    const despesasFixasMap = new Map<string, number>();
    const despesasVariaveisMap = new Map<string, number>();

    transacoesDespesaOperacional.forEach(t => {
      const cat = categoriasMap.get(t.categoryId || '');
      if (cat) {
        if (cat.nature === 'despesa_fixa') despesasFixasMap.set(cat.label, (despesasFixasMap.get(cat.label) || 0) + t.amount);
        else despesasVariaveisMap.set(cat.label, (despesasVariaveisMap.get(cat.label) || 0) + t.amount);
      }
    });
    
    const despesasFixas = Array.from(despesasFixasMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    const despesasVariaveis = Array.from(despesasVariaveisMap.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);

    const totalDespesasFixas = despesasFixas.reduce((acc, d) => acc + d.valor, 0);
    const totalDespesasVariaveis = despesasVariaveis.reduce((acc, d) => acc + d.valor, 0);

    const resultadoBruto = totalReceitaBruta - totalDespesasFixas;
    const resultadoOperacional = resultadoBruto - totalDespesasVariaveis;

    const totalRendimentos = transactions.filter(t => t.operationType === 'rendimento').reduce((acc, t) => acc + t.amount, 0);
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

    return {
      totalReceitaBruta,
      resultadoLiquido,
      resultadoBruto,
      resultadoOperacional,
      totalRendimentos,
      jurosEmprestimos,
      resultadoFinanceiro,
      receitasBrutas,
      despesasFixas,
      despesasVariaveis,
      totalDespesasFixas,
      totalDespesasVariaveis,
    };
  }, [categoriasV2, calculateLoanSchedule]);

  const dre1 = useMemo(() => calculateDRE(transacoesPeriodo1), [calculateDRE, transacoesPeriodo1]);
  const dre2 = useMemo(() => calculateDRE(transacoesPeriodo2), [calculateDRE, transacoesPeriodo2]);

  const variacaoRL = useMemo(() => {
    if (!range2.from) return 0;
    const diff = dre1.resultadoLiquido - dre2.resultadoLiquido;
    return dre2.resultadoLiquido !== 0 ? (diff / Math.abs(dre2.resultadoLiquido)) * 100 : 0;
  }, [dre1, dre2, range2.from]);

  const evolucaoMensal = useMemo(() => {
    const resultado: any[] = [];
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

      const receitasMes = transacoesMes.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento')).reduce((acc, t) => acc + t.amount, 0);
      const despesasMes = transacoesMes.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo' || t.operationType === 'veiculo')).reduce((acc, t) => acc + t.amount, 0);

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
    <div className="space-y-10">
      {/* Hero DRE - Resultado Líquido Expressivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-light dark:bg-surface-dark rounded-[40px] p-10 shadow-soft relative overflow-hidden border border-white/60 dark:border-white/5 h-[320px] flex flex-col justify-between group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-50"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-primary/10 rounded-2xl text-primary shadow-sm">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] opacity-70">Resultado Líquido</span>
                  <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mt-0.5">Performance do Período</p>
                </div>
              </div>
              
              <h2 className="font-display font-extrabold text-6xl sm:text-7xl text-foreground tracking-tighter leading-none tabular-nums">
                {formatCurrency(dre1.resultadoLiquido)}
              </h2>
              
              <div className="flex items-center gap-4 mt-8">
                <Badge variant="outline" className={cn(
                  "border-none px-4 py-1.5 rounded-xl font-black text-xs",
                  variacaoRL >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {variacaoRL >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1 inline" /> : <ArrowDownRight className="w-3 h-3 mr-1 inline" />}
                  {Math.abs(variacaoRL).toFixed(1)}% VS ANTERIOR
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <ReportCard
            title="Receita Bruta"
            value={formatCurrency(dre1.totalReceitaBruta)}
            status="success"
            icon={<TrendingUp className="w-6 h-6" />}
            className="rounded-[2.5rem] h-full p-8"
          />
          <ReportCard
            title="Despesa Operacional"
            value={formatCurrency(dre1.totalDespesasFixas + dre1.totalDespesasVariaveis)}
            status="danger"
            icon={<TrendingDown className="w-6 h-6" />}
            className="rounded-[2.5rem] h-full p-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Estrutura Contábil Expressiva */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 shadow-soft border border-white/60 dark:border-white/5 space-y-8">
          <div className="flex items-center gap-4 px-2">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-2xl text-foreground">Demonstração</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Estrutura de Resultados</p>
            </div>
          </div>

          <div className="space-y-1">
            <DREItem label="RECEITA BRUTA" value={dre1.totalReceitaBruta} type="receita" icon={<TrendingUp className="w-5 h-5" />} />
            {dre1.receitasBrutas.map((r, i) => (
              <DREItem key={i} label={r.categoria} value={r.valor} type="receita" level={1} />
            ))}

            <DREItem label="(-) DESPESAS FIXAS" value={dre1.totalDespesasFixas} type="despesa" icon={<Minus className="w-5 h-5" />} />
            {dre1.despesasFixas.map((d, i) => (
              <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            <DREItem label="RESULTADO BRUTO" value={dre1.resultadoBruto} type="subtotal" icon={<Equal className="w-5 h-5" />} />

            <DREItem label="(-) DESPESAS VARIÁVEIS" value={dre1.totalDespesasVariaveis} type="despesa" icon={<Minus className="w-5 h-5" />} />
            {dre1.despesasVariaveis.map((d, i) => (
              <DREItem key={i} label={d.categoria} value={d.valor} type="despesa" level={1} />
            ))}

            <DREItem label="RESULTADO OPERACIONAL" value={dre1.resultadoOperacional} type="subtotal" icon={<Zap className="w-5 h-5" />} />

            <DREItem label="RESULTADO FINANCEIRO" value={dre1.resultadoFinanceiro} type="subtotal" icon={<Calculator className="w-5 h-5" />} />
            <DREItem label="(+) Rendimentos" value={dre1.totalRendimentos} type="receita" level={1} />
            <DREItem label="(-) Juros Pagos" value={dre1.jurosEmprestimos} type="despesa" level={1} />

            <DREItem label="RESULTADO LÍQUIDO" value={dre1.resultadoLiquido} type="resultado" icon={<DollarSign className="w-6 h-6" />} />
          </div>
        </div>

        {/* Gráfico de Evolução Composto */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-10 shadow-soft border border-white/60 dark:border-white/5 space-y-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-2xl text-foreground">Evolução do Fluxo</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Receitas vs Despesas</p>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "none", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                />
                <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                <Bar dataKey="receitas" name="Receitas" fill={COLORS.success} opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="despesas" name="Despesas" fill={COLORS.danger} opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="resultado" name="Resultado" stroke={COLORS.primary} strokeWidth={4} dot={{ r: 4, fill: COLORS.primary, strokeWidth: 2, stroke: "#fff" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}