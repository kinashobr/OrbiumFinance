import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
  Cell,
} from "recharts";
import { Emprestimo } from "@/types/finance";
import { ExpandablePanel } from "@/components/reports/ExpandablePanel";
import { TrendingDown, BarChart3, Scale, PieChart } from "lucide-react";
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
        totalSaldoInicial += ultimaParcelaPaga ? ultimaParcelaPaga.saldoDevedor : e.valorTotal;
        totalParcelaFixa += e.parcela;
    });

    let currentSaldo = totalSaldoInicial;
    const result = [];
    for (let k = 0; k < 12; k++) {
        const mesLabel = meses[(now.getMonth() + k) % 12];
        const taxaMedia = emprestimos.reduce((acc, e) => acc + e.taxaMensal, 0) / Math.max(1, emprestimos.length);
        const i = taxaMedia / 100;
        const juros = currentSaldo * i;
        const amortizacao = totalParcelaFixa - juros;
        currentSaldo = Math.max(0, currentSaldo - amortizacao);
        result.push({ mes: mesLabel, saldo: currentSaldo });
    }
    return result;
  }, [emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate]);

  const jurosAmortizacao = useMemo(() => {
    const baseLoan = emprestimos.find(e => e.status === 'ativo');
    if (!baseLoan) return [];
    return calculateLoanSchedule(baseLoan.id).slice(0, 12).map(item => ({
        parcela: `${item.parcela}ª`,
        juros: item.juros,
        amortizacao: item.amortizacao,
    }));
  }, [emprestimos, calculateLoanSchedule]);

  const radialData = useMemo(() => {
    return emprestimos.map((e, index) => {
      const schedule = calculateLoanSchedule(e.id);
      const paidCount = calculatePaidInstallmentsUpToDate(e.id, new Date());
      const lastPaid = schedule.find(item => item.parcela === paidCount);
      const saldo = lastPaid ? lastPaid.saldoDevedor : e.valorTotal;
      
      const palette = [colors.primary, colors.accent, colors.success, colors.warning];
      
      return {
        name: e.contrato.split(" - ")[0],
        value: saldo,
        fill: palette[index % palette.length],
      };
    }).sort((a, b) => b.value - a.value);
  }, [emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate, colors]);

  if (emprestimos.length === 0) return null;

  return (
    <div className={cn("space-y-8", className)}>
      {/* Evolução - Estilo Clean */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <TrendingDown className="w-4 h-4 text-primary" />
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Projeção de Quitação</h4>
        </div>
        <div className="h-[220px] glass-card p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoSaldo}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 10 }} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: colors.card, border: 'none', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                formatter={(v: number) => [formatCurrency(v), "Saldo"]}
              />
              <Line type="stepAfter" dataKey="saldo" stroke={colors.primary} strokeWidth={4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Radial Chart - Comparativo */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <PieChart className="w-4 h-4 text-accent" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Peso por Contrato</h4>
          </div>
          <div className="h-[300px] glass-card flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" cy="50%" 
                innerRadius="20%" outerRadius="90%" 
                barSize={14} 
                data={radialData}
                startAngle={180} endAngle={-180}
              >
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={10}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: colors.card, border: 'none', borderRadius: '16px' }}
                    formatter={(v: number) => formatCurrency(v)}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-black text-muted-foreground uppercase">Saldo Total</p>
                <p className="text-xl font-black text-foreground">
                    {formatCurrency(radialData.reduce((acc, d) => acc + d.value, 0))}
                </p>
            </div>
          </div>
        </div>

        {/* Stacked Bars - Juros x Amortização */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="w-4 h-4 text-success" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Composição da Parcela</h4>
          </div>
          <div className="h-[300px] glass-card p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jurosAmortizacao}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
                <XAxis dataKey="parcela" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 10 }} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: colors.card, border: 'none', borderRadius: '16px' }} />
                <Bar dataKey="amortizacao" name="Principal" stackId="a" fill={colors.success} radius={[0, 0, 4, 4]} />
                <Bar dataKey="juros" name="Juros" stackId="a" fill={colors.destructive} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}