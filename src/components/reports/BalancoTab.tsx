import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Scale, Wallet, CreditCard, Droplets, ShieldCheck, ArrowRight, Building2, Car, Landmark, Plus, Minus, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn, parseDateLocal } from "@/lib/utils";
import { addMonths } from "date-fns";
import { ComparisonDateRanges, DateRange } from "@/types/finance";

const COLORS = { success: "hsl(142, 76%, 36%)", danger: "hsl(0, 72%, 51%)", primary: "hsl(199, 89%, 48%)", accent: "hsl(270, 80% 60%)" };

const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface BalancoItemProps {
  label: string;
  value1: number;
  value2: number;
  type: 'ativo' | 'passivo' | 'subtotal' | 'pl';
  icon?: React.ReactNode;
  level?: number;
}

function BalancoItem({ label, value1, value2, type, icon, level = 0 }: BalancoItemProps) {
  const diff = value1 - value2;
  const percent = value2 !== 0 ? (diff / Math.abs(value2)) * 100 : 0;
  
  const typeClasses = {
    ativo: "text-foreground",
    passivo: "text-foreground",
    subtotal: "font-semibold bg-muted/30 border-t border-b border-border/80",
    pl: "font-bold text-lg bg-primary/10 border-t-2 border-b-2 border-primary/50",
  };
  
  return (
    <div className={cn("flex items-center justify-between py-2 px-4 border-b border-border/50 transition-colors hover:bg-muted/10", typeClasses[type], level > 0 && "pl-8")}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right w-24 opacity-40">
          <span className="text-xs block">{formatCurrency(value2)}</span>
        </div>
        <div className="text-right w-32">
          <span className="font-medium block">{formatCurrency(value1)}</span>
          {value2 !== 0 && (
            <span className={cn(
              "text-[10px] font-bold", 
              diff > 0 
                ? (type === 'ativo' || type === 'pl' ? "text-success" : "text-destructive") 
                : (type === 'ativo' || type === 'pl' ? "text-destructive" : "text-success")
            )}>
              {diff > 0 ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, contasMovimento, getAtivosTotal, getPassivosTotal, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining } = useFinance();
  const { range1, range2 } = dateRanges;

  const calculateBalanco = useCallback((range: DateRange) => {
    const date = range.to || new Date();
    const totalAtivos = getAtivosTotal(date);
    const totalPassivos = getPassivosTotal(date);
    const pl = totalAtivos - totalPassivos;

    const cash = contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType))
      .reduce((acc, c) => acc + Math.max(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)), 0);

    const loanShortTerm = calculateLoanPrincipalDueInNextMonths(date, 12);
    const cardDebt = transacoesV2.filter(t => {
      const acc = contasMovimento.find(a => a.id === t.accountId);
      return acc?.accountType === 'cartao_credito' && parseDateLocal(t.date) <= addMonths(date, 1);
    }).reduce((acc, t) => acc + (t.flow === 'out' ? t.amount : -t.amount), 0);

    return { totalAtivos, totalPassivos, pl, cash, curtoPrazo: loanShortTerm + Math.max(0, cardDebt) };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getAtivosTotal, getPassivosTotal, calculateLoanPrincipalDueInNextMonths]);

  const b1 = useMemo(() => calculateBalanco(range1), [calculateBalanco, range1]);
  const b2 = useMemo(() => calculateBalanco(range2), [calculateBalanco, range2]);

  const varPL = b2.pl !== 0 ? ((b1.pl - b2.pl) / Math.abs(b2.pl)) * 100 : 0;
  const varAtivos = b2.totalAtivos !== 0 ? ((b1.totalAtivos - b2.totalAtivos) / Math.abs(b2.totalAtivos)) * 100 : 0;

  const chartData = [
    { name: 'Ativos', p1: b1.totalAtivos, p2: b2.totalAtivos },
    { name: 'Passivos', p1: b1.totalPassivos, p2: b2.totalPassivos },
    { name: 'Patrimônio', p1: b1.pl, p2: b2.pl }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard title="Ativo Total" value={formatCurrency(b1.totalAtivos)} trend={varAtivos} trendLabel="vs P2" status="success" icon={<TrendingUp className="w-5 h-5" />} />
        <ReportCard title="Passivo Total" value={formatCurrency(b1.totalPassivos)} trend={b2.totalPassivos ? ((b1.totalPassivos - b2.totalPassivos)/b2.totalPassivos)*100 : 0} trendLabel="vs P2" status="danger" icon={<TrendingDown className="w-5 h-5" />} />
        <ReportCard title="Patrimônio Líquido" value={formatCurrency(b1.pl)} trend={varPL} trendLabel="vs P2" status={b1.pl >= 0 ? "success" : "danger"} icon={<Scale className="w-5 h-5" />} />
        <ReportCard title="Liquidez Corrente" value={(b1.cash / (b1.curtoPrazo || 1)).toFixed(2) + 'x'} status={b1.cash / (b1.curtoPrazo || 1) > 1.2 ? "success" : "warning"} icon={<Droplets className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel title="Estrutura Patrimonial" icon={<ShieldCheck className="w-4 h-4" />}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="p1" name="Período 1" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="p2" name="Período 2" fill={COLORS.accent} radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExpandablePanel>

        <ExpandablePanel title="Variações de Saldo" icon={<Wallet className="w-4 h-4" />}>
          <Table>
            <TableBody>
              <TableRow className="font-bold bg-muted/20"><TableCell>Item</TableCell><TableCell className="text-right">P1</TableCell><TableCell className="text-right">P2</TableCell></TableRow>
              <TableRow><TableCell>Disponibilidades (Caixa)</TableCell><TableCell className="text-right text-success">{formatCurrency(b1.cash)}</TableCell><TableCell className="text-right opacity-50">{formatCurrency(b2.cash)}</TableCell></TableRow>
              <TableRow><TableCell>Obrigações Curto Prazo</TableCell><TableCell className="text-right text-destructive">{formatCurrency(b1.curtoPrazo)}</TableCell><TableCell className="text-right opacity-50">{formatCurrency(b2.curtoPrazo)}</TableCell></TableRow>
              <TableRow className="font-bold"><TableCell>Capital de Giro Líquido</TableCell><TableCell className="text-right">{formatCurrency(b1.cash - b1.curtoPrazo)}</TableCell><TableCell className="text-right opacity-50">{formatCurrency(b2.cash - b2.curtoPrazo)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </ExpandablePanel>
      </div>

      <ExpandablePanel title="Balanço Patrimonial Detalhado" subtitle="Comparação de saldos entre P1 e P2" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="glass-card p-0 overflow-hidden">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between py-2 px-4 bg-muted/50 border-b border-border font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Contas Patrimoniais</span>
            <div className="flex gap-6">
              <span className="w-24 text-right">P2 (Saldo)</span>
              <span className="w-32 text-right">P1 (Saldo)</span>
            </div>
          </div>

          {/* ATIVOS */}
          <BalancoItem label="ATIVOS (O QUE VOCÊ TEM)" value1={d1.totalAtivos} value2={d2.totalAtivos} type="subtotal" icon={<Plus className="w-4 h-4 text-success" />} />
          <BalancoItem label="Disponibilidades (Caixa e Bancos)" value1={d1.totalCash} value2={d2.totalCash} type="ativo" level={1} icon={<Wallet className="w-3 h-3 opacity-50" />} />
          {d1.cashAccounts.map((acc, idx) => (
            <BalancoItem key={acc.name} label={acc.name} value1={acc.balance} value2={d2.cashAccounts[idx]?.balance || 0} type="ativo" level={2} />
          ))}
          <BalancoItem label="Imobilizado (Veículos - FIPE)" value1={d1.fipe} value2={d2.fipe} type="ativo" level={1} icon={<Car className="w-3 h-3 opacity-50" />} />
          <BalancoItem label="Seguros a Apropriar (Ativo Diferido)" value1={d1.segurosAtivo} value2={d2.segurosAtivo} type="ativo" level={1} icon={<ShieldCheck className="w-3 h-3 opacity-50" />} />

          {/* PASSIVOS */}
          <BalancoItem label="PASSIVOS (O QUE VOCÊ DEVE)" value1={d1.totalPassivos} value2={d2.totalPassivos} type="subtotal" icon={<Minus className="w-4 h-4 text-destructive" />} />
          <BalancoItem label="Empréstimos e Financiamentos" value1={d1.loans} value2={d2.loans} type="passivo" level={1} icon={<Landmark className="w-3 h-3 opacity-50" />} />
          <BalancoItem label="Dívida de Cartões de Crédito" value1={d1.cards} value2={d2.cards} type="passivo" level={1} icon={<CreditCard className="w-3 h-3 opacity-50" />} />
          <BalancoItem label="Seguros a Pagar (Obrigações)" value1={d1.segurosPassivo} value2={d2.segurosPassivo} type="passivo" level={1} icon={<Clock className="w-3 h-3 opacity-50" />} />

          {/* PATRIMÔNIO LÍQUIDO */}
          <BalancoItem label="PATRIMÔNIO LÍQUIDO (RIQUEZA REAL)" value1={pl1} value2={pl2} type="pl" icon={<Scale className="w-5 h-5" />} />
        </div>
      </ExpandablePanel>
    </div>
  );
}