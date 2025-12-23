import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Scale, Wallet, Building2, Car, CreditCard, Banknote, PiggyBank, Bitcoin, Target, ShieldCheck, ChevronRight, Droplets, Shield } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart } from "recharts";
import { useFinance } from "@/contexts/FinanceContext";
import { ReportCard } from "./ReportCard";
import { ExpandablePanel } from "./ExpandablePanel";
import { DetailedIndicatorBadge } from "./DetailedIndicatorBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, parseDateLocal } from "@/lib/utils";
import { format, startOfDay, endOfDay, addMonths, isBefore, isAfter, isSameDay, differenceInDays } from "date-fns";
import { ComparisonDateRanges, DateRange, ACCOUNT_TYPE_LABELS } from "@/types/finance";
import { EvolucaoPatrimonialChart } from "@/components/dashboard/EvolucaoPatrimonialChart";

const COLORS = { success: "hsl(142, 76%, 36%)", warning: "hsl(38, 92%, 50%)", danger: "hsl(0, 72%, 51%)", primary: "hsl(199, 89%, 48%)", accent: "hsl(270, 80% 60%)", muted: "hsl(215, 20% 55%)", gold: "hsl(45, 93%, 47%)", cyan: "hsl(180, 70%, 50%)" };
const PIE_COLORS = [COLORS.primary, COLORS.accent, COLORS.success, COLORS.warning, COLORS.gold, COLORS.cyan, COLORS.danger];

const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const formatPercent = (v: number) => `${v.toFixed(1)}%`;

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, contasMovimento, emprestimos, segurosVeiculo, getAtivosTotal, getPassivosTotal, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining } = useFinance();
  const { range1, range2 } = dateRanges;

  const calculateBalanco = useCallback((range: DateRange) => {
    const date = range.to || new Date();
    const saldos = Object.fromEntries(contasMovimento.map(c => [c.id, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)]));

    const ativosCirculantes = contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa', 'cripto'].includes(c.accountType)).reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0);
    const segurosAApropriar = getSegurosAApropriar(date);
    const totalAtivos = getAtivosTotal(date);

    const totalLoanPrincipal = getLoanPrincipalRemaining(date);
    const loanShortTerm = calculateLoanPrincipalDueInNextMonths(date, 12);
    
    const cardDebt = transacoesV2.filter(t => {
      const acc = contasMovimento.find(a => a.id === t.accountId);
      return acc?.accountType === 'cartao_credito' && parseDateLocal(t.date) <= addMonths(date, 1);
    }).reduce((acc, t) => acc + (t.flow === 'out' ? t.amount : -t.amount), 0);

    const segurosAPagar = getSegurosAPagar(date);
    const totalPassivos = getPassivosTotal(date) + Math.max(0, cardDebt);
    const pl = totalAtivos - totalPassivos;

    return {
      ativos: { total: totalAtivos, circulante: ativosCirculantes + segurosAApropriar, imobilizado: getValorFipeTotal(date) },
      passivos: { total: totalPassivos, curtoPrazo: loanShortTerm + Math.max(0, cardDebt), longoPrazo: totalPassivos - (loanShortTerm + Math.max(0, cardDebt)) },
      pl,
      saldos
    };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining]);

  const b1 = useMemo(() => calculateBalanco(range1), [calculateBalanco, range1]);
  const b2 = useMemo(() => calculateBalanco(range2), [calculateBalanco, range2]);

  const varPL = b2.pl !== 0 ? ((b1.pl - b2.pl) / Math.abs(b2.pl)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard title="Ativo Total" value={formatCurrency(b1.ativos.total)} status="success" icon={<TrendingUp className="w-5 h-5" />} />
        <ReportCard title="Passivo Total" value={formatCurrency(b1.passivos.total)} status="danger" icon={<TrendingDown className="w-5 h-5" />} />
        <ReportCard title="Patrimônio Líquido" value={formatCurrency(b1.pl)} status={b1.pl >= 0 ? "success" : "danger"} icon={<Scale className="w-5 h-5" />} />
        <ReportCard title="Variação PL" value={formatPercent(varPL)} trend={varPL} status={varPL >= 0 ? "success" : "danger"} icon={<Droplets className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpandablePanel title="ATIVO" icon={<Wallet className="w-4 h-4" />} badge={formatCurrency(b1.ativos.total)} badgeStatus="success">
          <Table>
            <TableBody>
              <TableRow className="bg-success/5"><TableCell colSpan={2} className="font-bold text-success">CIRCULANTE (Liquidez)</TableCell></TableRow>
              {contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa', 'cripto'].includes(c.accountType)).map(c => (
                <TableRow key={c.id}><TableCell className="pl-6">{c.name}</TableCell><TableCell className="text-right text-success">{formatCurrency(b1.saldos[c.id] || 0)}</TableCell></TableRow>
              ))}
              <TableRow className="bg-primary/5"><TableCell colSpan={2} className="font-bold text-primary">NÃO CIRCULANTE (Imobilizado)</TableCell></TableRow>
              <TableRow><TableCell className="pl-6">Veículos (FIPE)</TableCell><TableCell className="text-right">{formatCurrency(b1.ativos.imobilizado)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </ExpandablePanel>

        <ExpandablePanel title="PASSIVO" icon={<CreditCard className="w-4 h-4" />} badge={formatCurrency(b1.passivos.total)} badgeStatus="danger">
          <Table>
            <TableBody>
              <TableRow className="bg-warning/5"><TableCell colSpan={2} className="font-bold text-warning">CURTO PRAZO (12 meses)</TableCell></TableRow>
              <TableRow><TableCell className="pl-6">Dívidas e Cartões</TableCell><TableCell className="text-right text-destructive">{formatCurrency(b1.passivos.curtoPrazo)}</TableCell></TableRow>
              <TableRow className="bg-destructive/5"><TableCell colSpan={2} className="font-bold text-destructive">LONGO PRAZO</TableCell></TableRow>
              <TableRow><TableCell className="pl-6">Financiamentos</TableCell><TableCell className="text-right">{formatCurrency(b1.passivos.longoPrazo)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </ExpandablePanel>
      </div>

      <ExpandablePanel title="Indicadores de Solvência" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DetailedIndicatorBadge title="Liquidez Corrente" value={(b1.ativos.circulante / (b1.passivos.curtoPrazo || 1)).toFixed(2) + 'x'} status={b1.ativos.circulante / (b1.passivos.curtoPrazo || 1) > 1.5 ? "success" : "warning"} descricao="Capacidade de pagar dívidas imediatas." formula="Ativo Circulante / Passivo Curto Prazo" />
          <DetailedIndicatorBadge title="Endividamento" value={formatPercent((b1.passivos.total / b1.ativos.total) * 100)} status={(b1.passivos.total / b1.ativos.total) < 0.4 ? "success" : "danger"} descricao="Comprometimento do patrimônio com terceiros." formula="Passivo Total / Ativo Total" />
          <DetailedIndicatorBadge title="Indice de Solvência" value={(b1.ativos.total / (b1.passivos.total || 1)).toFixed(2) + 'x'} status={b1.ativos.total / (b1.passivos.total || 1) > 2 ? "success" : "danger"} descricao="Segurança total do patrimônio." formula="Ativo Total / Passivo Total" />
        </div>
      </ExpandablePanel>
    </div>
  );
}