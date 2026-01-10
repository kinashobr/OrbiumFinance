import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Emprestimo } from "@/types/finance";
import { ExpandablePanel } from "@/components/reports/ExpandablePanel";
import { TrendingDown, BarChart3, Calendar, Scale, DollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartColors } from "@/hooks/useChartColors";
import { useFinance } from "@/contexts/FinanceContext";

interface LoanChartsProps {
  emprestimos: Emprestimo[];
  className?: string;
}

export function LoanCharts({ emprestimos, className }: LoanChartsProps) {
  const colors = useChartColors();
  const { calculateLoanSchedule, calculatePaidInstallmentsUpToDate } = useFinance();
  
  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  // Evolução do saldo devedor (Projeção dos próximos 12 meses)
  const evolucaoSaldo = useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    
    let totalSaldoInicial = 0;
    let totalParcelaFixa = 0;
    
    emprestimos.forEach(e => {
        if (e.status === 'quitado' || e.status === 'pendente_config') return;
        
        const schedule = calculateLoanSchedule(e.id);
        const parcelasPagas = calculatePaidInstallmentsUpToDate(e.id, now);
        
        const ultimaParcelaPaga = schedule.find(item => item.parcela === parcelasPagas);
        const saldoAtual = ultimaParcelaPaga ? ultimaParcelaPaga.saldoDevedor : e.valorTotal;
        
        totalSaldoInicial += saldoAtual;
        totalParcelaFixa += e.parcela;
    });

    let currentSaldo = totalSaldoInicial;
    const result = [];
    
    for (let k = 0; k < 12; k++) {
        const mesLabel = meses[(now.getMonth() + k) % 12];
        
        if (currentSaldo <= 0 && k > 0) { // Se já quitou, mantém saldo zero
            result.push({ mes: mesLabel, saldo: 0, juros: 0, amortizacao: 0 });
            continue;
        }
        
        const taxaMedia = emprestimos.reduce((acc, e) => acc + e.taxaMensal, 0) / Math.max(1, emprestimos.length);
        const i = taxaMedia / 100;
        
        const juros = currentSaldo * i;
        const amortizacao = totalParcelaFixa - juros;
        
        currentSaldo = Math.max(0, currentSaldo - amortizacao);
        
        result.push({
            mes: mesLabel,
            saldo: currentSaldo,
            juros: Math.max(0, juros),
            amortizacao: Math.max(0, amortizacao),
        });
    }
    
    return result;
  }, [emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate]);

  // Juros x Amortização por parcela (Composição da Parcela Média)
  const jurosAmortizacao = useMemo(() => {
    const baseLoan = emprestimos.find(e => e.status === 'ativo');
    if (!baseLoan) return [];
    
    const schedule = calculateLoanSchedule(baseLoan.id);
    
    return schedule.slice(0, 12).map(item => ({
        parcela: `${item.parcela}ª`,
        juros: item.juros,
        amortizacao: item.amortizacao,
        totalParcela: item.juros + item.amortizacao,
    }));
  }, [emprestimos, calculateLoanSchedule]);

  // Comparativo entre empréstimos
  const comparativo = useMemo(() => {
    return emprestimos.map((e) => {
      const schedule = calculateLoanSchedule(e.id);
      const parcelasPagas = calculatePaidInstallmentsUpToDate(e.id, new Date());
      
      const ultimaParcelaPaga = schedule.find(item => item.parcela === parcelasPagas);
      const saldoDevedor = ultimaParcelaPaga ? ultimaParcelaPaga.saldoDevedor : e.valorTotal;
      
      const custoTotal = e.parcela * e.meses;
      const jurosTotal = custoTotal - e.valorTotal;
      
      return {
        nome: e.contrato.split(" - ")[0].substring(0, 10),
        valorOriginal: e.valorTotal,
        saldoDevedor: Math.max(0, saldoDevedor),
        jurosTotal,
        taxa: e.taxaMensal,
      };
    });
  }, [emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate]);

  if (emprestimos.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Adicione empréstimos para visualizar os gráficos</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Evolução do Saldo Devedor - LineChart */}
      <ExpandablePanel
        title="Evolução do Saldo Devedor"
        subtitle="Projeção dos próximos 12 meses"
        icon={<TrendingDown className="w-4 h-4" />}
      >
        <div className="h-[min(280px,40vh)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoSaldo}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.5} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.mutedForeground, fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [formatCurrency(value), "Saldo"]}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke={colors.accent}
                strokeWidth={3}
                dot={{ r: 4, fill: colors.accent, strokeWidth: 2, stroke: colors.card }}
                activeDot={{ r: 6, fill: colors.accent, strokeWidth: 2, stroke: colors.card }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ExpandablePanel>

      {/* Juros x Amortização - ComposedChart */}
      <ExpandablePanel
        title="Juros x Amortização por Parcela (Média)"
        subtitle="Composição do pagamento"
        icon={<BarChart3 className="w-4 h-4" />}
      >
        <div className="h-[min(280px,40vh)]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={jurosAmortizacao}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.5} />
              <XAxis dataKey="parcela" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.mutedForeground, fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [formatCurrency(value)]}
              />
              <Legend />
              <Bar dataKey="juros" name="Juros" fill={colors.destructive} radius={[4, 4, 0, 0]} stackId="stack" />
              <Bar dataKey="amortizacao" name="Amortização" fill={colors.success} radius={[4, 4, 0, 0]} stackId="stack" />
              <Line type="monotone" dataKey="totalParcela" name="Total Parcela" stroke={colors.primary} strokeWidth={2} dot={{ r: 3, fill: colors.primary, strokeWidth: 1, stroke: colors.card }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ExpandablePanel>

      {/* Comparativo entre Empréstimos - BarChart Vertical */}
      <ExpandablePanel
        title="Comparativo entre Empréstimos"
        subtitle="Análise de valores e taxas"
        icon={<Scale className="w-4 h-4" />}
      >
        <div className="h-[min(280px,40vh)]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparativo}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.5} />
              <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 11 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: colors.primary, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Taxa") return [`${value.toFixed(2)}%`, name];
                  return [formatCurrency(value), name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="valorOriginal" name="Valor Original" fill={colors.primary} opacity={0.8} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="saldoDevedor" name="Saldo Devedor" fill={colors.destructive} opacity={0.8} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="jurosTotal" name="Juros Total" fill={colors.warning} opacity={0.8} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa" stroke={colors.success} strokeWidth={2} dot={{ r: 3, fill: colors.success, strokeWidth: 1, stroke: colors.card }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ExpandablePanel>
    </div>
  );
}