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
} from "recharts";
import { Emprestimo } from "@/types/finance";
import { TrendingDown, BarChart3, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartColors } from "@/hooks/useChartColors";
import { useFinance } from "@/contexts/FinanceContext";
import { Badge } from "@/components/ui/badge";

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

  const radialData = useMemo(() => {
    const palette = [colors.primary, colors.accent, colors.success, colors.warning, colors.destructive];
    return emprestimos.map((e, index) => {
      const schedule = calculateLoanSchedule(e.id);
      const paidCount = calculatePaidInstallmentsUpToDate(e.id, new Date());
      const lastPaid = schedule.find(item => item.parcela === paidCount);
      const saldo = lastPaid ? lastPaid.saldoDevedor : e.valorTotal;
      
      return {
        name: e.contrato.split(" - ")[0],
        value: saldo,
        fill: palette[index % palette.length],
      };
    }).sort((a, b) => b.value - a.value);
  }, [emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate, colors]);

  const totalSaldoRadial = useMemo(() => radialData.reduce((acc, d) => acc + d.value, 0), [radialData]);

  if (emprestimos.length === 0) return null;

  return (
    <div className={cn("space-y-12", className)}>
      {/* Projeção de Quitação */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-primary" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Curva de Amortização 12m</h4>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[9px] font-black tracking-widest px-2 py-0.5">ESTIMATIVA</Badge>
        </div>
        <div className="h-[260px] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoSaldo}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 11, fontWeight: 'bold' }} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: '12px' }}
                formatter={(v: number) => [formatCurrency(v), "Saldo Projetado"]}
              />
              <Line type="monotone" dataKey="saldo" stroke={colors.primary} strokeWidth={5} dot={{ r: 6, fill: colors.primary, strokeWidth: 3, stroke: 'white' }} activeDot={{ r: 8, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Distribuição por Peso */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <PieChart className="w-5 h-5 text-accent" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Distribuição de Peso</h4>
          </div>
          <div className="h-[320px] flex items-center justify-center relative bg-muted/20 rounded-[3rem] border border-border/40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" cy="50%" 
                innerRadius="30%" outerRadius="100%" 
                barSize={16} 
                data={radialData}
                startAngle={180} endAngle={-180}
              >
                <RadialBar
                  background={{ fill: colors.border, opacity: 0.1 }}
                  dataKey="value"
                  cornerRadius={20}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '16px' }}
                    formatter={(v: number) => formatCurrency(v)}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total</p>
                <p className="text-2xl font-black text-foreground tracking-tighter">
                    {formatCurrency(totalSaldoRadial)}
                </p>
            </div>
          </div>
        </div>

        {/* Composição das Parcelas */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <BarChart3 className="w-5 h-5 text-success" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Capital vs Juros</h4>
          </div>
          <div className="h-[320px] bg-muted/20 rounded-[3rem] border border-border/40 p-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emprestimos.slice(0, 5).map(e => ({ name: e.contrato.split(' ')[0], capital: e.valorTotal, juros: (e.parcela * e.meses) - e.valorTotal }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.mutedForeground, fontSize: 10, fontWeight: 'bold' }} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '16px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="capital" name="Principal" stackId="a" fill={colors.success} radius={[0, 0, 8, 8]} />
                <Bar dataKey="juros" name="Juros Totais" stackId="a" fill={colors.destructive} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}