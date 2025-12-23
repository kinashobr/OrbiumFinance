import { useMemo, useState, useCallback } from "react";
import {
  Droplets,
  Shield,
  TrendingUp,
  TrendingDown,
  Gauge,
  Wallet,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Percent,
  PiggyBank,
  HeartPulse,
  Clock,
  Car,
  Calculator,
  Plus,
  Info,
  Settings,
  Save,
  Trash2,
  Zap,
  ShieldCheck,
  Scale
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ExpandablePanel } from "./ExpandablePanel";
import { DetailedIndicatorBadge } from "./DetailedIndicatorBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, parseDateLocal } from "@/lib/utils";
import { format, differenceInDays, isWithinInterval, startOfDay, endOfDay, addMonths, isBefore, isAfter, isSameDay } from "date-fns";
import { toast } from "sonner";
import { ComparisonDateRanges, DateRange } from "@/types/finance";

type IndicatorStatus = "success" | "warning" | "danger" | "neutral";

interface IndicadoresTabProps {
  dateRanges: ComparisonDateRanges;
}

export function IndicadoresTab({ dateRanges }: IndicadoresTabProps) {
  const {
    transacoesV2,
    contasMovimento,
    emprestimos,
    veiculos,
    categoriasV2,
    segurosVeiculo,
    getAtivosTotal,
    getPassivosTotal,
    getPatrimonioLiquido,
    getSaldoDevedor,
    calculateBalanceUpToDate,
    getValorFipeTotal,
    getSegurosAPagar,
    calculateLoanPrincipalDueInNextMonths,
    calculateLoanSchedule,
  } = useFinance();

  const { range1, range2 } = dateRanges;

  const calculatePercentChange = useCallback((value1: number, value2: number) => {
    if (value2 === 0) return 0;
    return ((value1 - value2) / Math.abs(value2)) * 100;
  }, []);

  const generateSparkline = useCallback((current: number, trend: "up" | "down" | "stable" = "stable") => {
    const base = Math.abs(current) * 0.7;
    const range = Math.abs(current) * 0.3 || 10;
    return Array.from({ length: 6 }, (_, i) => {
      const progress = i / 5;
      if (trend === "up") return base + range * progress + Math.random() * range * 0.2;
      if (trend === "down") return base + range * (1 - progress) + Math.random() * range * 0.2;
      return base + range * 0.5 + (Math.random() - 0.5) * range * 0.4;
    }).concat([Math.abs(current)]);
  }, []);

  const calculateData = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date();
    const startDate = range.from || startOfDay(new Date());

    // 1. Saldos e Ativos
    const totalAtivos = getAtivosTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    const patrimonioLiquido = totalAtivos - totalPassivos;
    
    const contasLiquidas = contasMovimento.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)
    );
    const reservaLiquida = contasLiquidas.reduce((acc, c) => 
      acc + Math.max(0, calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento)), 0
    );

    // 2. Fluxo de Caixa (Período)
    const txs = transacoesV2.filter(t => {
      const d = parseDateLocal(t.date);
      return isWithinInterval(d, { start: startOfDay(startDate), end: endOfDay(finalDate) });
    });

    const receitas = txs.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento').reduce((acc, t) => acc + t.amount, 0);
    const rendimentosPassivos = txs.filter(t => t.operationType === 'rendimento').reduce((acc, t) => acc + t.amount, 0);
    
    const despesasTotais = txs.filter(t => t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo').reduce((acc, t) => acc + t.amount, 0);
    
    const categoriasMap = new Map(categoriasV2.map(c => [c.id, c]));
    const despesasFixas = txs.filter(t => {
        const cat = categoriasMap.get(t.categoryId || '');
        return cat?.nature === 'despesa_fixa' || t.operationType === 'pagamento_emprestimo';
    }).reduce((acc, t) => acc + t.amount, 0);

    // 3. Cálculos de Indicadores
    const taxaPoupanca = receitas > 0 ? ((receitas - despesasTotais) / receitas) * 100 : 0;
    const mesesSobrevivencia = despesasTotais > 0 ? reservaLiquida / (despesasTotais / (differenceInDays(finalDate, startDate) / 30 || 1)) : 0;
    const grauIndependencia = despesasTotais > 0 ? (rendimentosPassivos / despesasTotais) * 100 : 0;
    const comprometimentoRenda = receitas > 0 ? (despesasFixas / receitas) * 100 : 0;
    const solvenciaGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : 999;

    return {
      reservaLiquida,
      receitas,
      despesasTotais,
      despesasFixas,
      patrimonioLiquido,
      taxaPoupanca,
      mesesSobrevivencia,
      grauIndependencia,
      comprometimentoRenda,
      solvenciaGeral,
      totalAtivos,
      totalPassivos
    };
  }, [contasMovimento, transacoesV2, categoriasV2, getAtivosTotal, getPassivosTotal, calculateBalanceUpToDate]);

  const data1 = useMemo(() => calculateData(range1), [calculateData, range1]);
  const data2 = useMemo(() => calculateData(range2), [calculateData, range2]);

  const getTrend = (v1: number, v2: number, inverse = false) => {
    if (!range2.from || v2 === 0) return "stable";
    const p = calculatePercentChange(v1, v2);
    if (Math.abs(p) < 0.1) return "stable";
    return inverse ? (p < 0 ? "up" : "down") : (p > 0 ? "up" : "down");
  };

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* GRUPO 1: SEGURANÇA E SOBREVIVÊNCIA */}
      <ExpandablePanel title="Segurança e Sobrevivência" subtitle="Sua rede de proteção financeira" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailedIndicatorBadge
            title="Reserva de Emergência"
            value={data1.mesesSobrevivencia.toFixed(1) + " meses"}
            status={data1.mesesSobrevivencia >= 6 ? "success" : data1.mesesSobrevivencia >= 3 ? "warning" : "danger"}
            trend={getTrend(data1.mesesSobrevivencia, data2.mesesSobrevivencia)}
            descricao="Quantos meses você mantém seu padrão de vida apenas com sua liquidez atual."
            formula="Liquidez Imediata / Média de Despesas Mensais"
            icon={<Clock className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Solvência Geral"
            value={data1.solvenciaGeral.toFixed(2) + "x"}
            status={data1.solvenciaGeral >= 2 ? "success" : data1.solvenciaGeral >= 1.2 ? "warning" : "danger"}
            trend={getTrend(data1.solvenciaGeral, data2.solvenciaGeral)}
            descricao="Capacidade de quitar todas as suas dívidas vendendo todos os seus ativos."
            formula="Total de Ativos / Total de Passivos"
            icon={<Scale className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Liquidez Disponível"
            value={formatCurrency(data1.reservaLiquida)}
            status="neutral"
            trend={getTrend(data1.reservaLiquida, data2.reservaLiquida)}
            descricao="Dinheiro disponível imediatamente em contas e aplicações de resgate diário."
            formula="Σ (Saldos em Contas Correntes + Poupança + Renda Fixa Líquida)"
            icon={<Droplets className="w-4 h-4" />}
          />
        </div>
      </ExpandablePanel>

      {/* GRUPO 2: EFICIÊNCIA E CRESCIMENTO */}
      <ExpandablePanel title="Eficiência e Crescimento" subtitle="Como você gerencia o que ganha" icon={<Zap className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailedIndicatorBadge
            title="Taxa de Poupança"
            value={formatPercent(data1.taxaPoupanca)}
            status={data1.taxaPoupanca >= 20 ? "success" : data1.taxaPoupanca >= 10 ? "warning" : "danger"}
            trend={getTrend(data1.taxaPoupanca, data2.taxaPoupanca)}
            descricao="Percentual da sua renda que sobra após todas as despesas. O motor da sua riqueza."
            formula="((Receitas - Despesas) / Receitas) × 100"
            icon={<PiggyBank className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Comprometimento Fixo"
            value={formatPercent(data1.comprometimentoRenda)}
            status={data1.comprometimentoRenda <= 50 ? "success" : data1.comprometimentoRenda <= 70 ? "warning" : "danger"}
            trend={getTrend(data1.comprometimentoRenda, data2.comprometimentoRenda, true)}
            descricao="Quanto da sua renda está 'presa' em gastos fixos e dívidas. Menor é melhor."
            formula="(Despesas Fixas + Parcelas / Receitas) × 100"
            icon={<Activity className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Independência Financeira"
            value={formatPercent(data1.grauIndependencia)}
            status={data1.grauIndependencia >= 100 ? "success" : data1.grauIndependencia >= 20 ? "warning" : "neutral"}
            trend={getTrend(data1.grauIndependencia, data2.grauIndependencia)}
            descricao="Quanto das suas despesas são pagas por rendimentos passivos (juros, dividendos)."
            formula="(Rendimentos de Investimentos / Despesas Totais) × 100"
            icon={<Target className="w-4 h-4" />}
          />
        </div>
      </ExpandablePanel>

      {/* GRUPO 3: PATRIMÔNIO */}
      <ExpandablePanel title="Análise Patrimonial" subtitle="Estrutura da sua riqueza" icon={<TrendingUp className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailedIndicatorBadge
            title="Patrimônio Líquido"
            value={formatCurrency(data1.patrimonioLiquido)}
            status={data1.patrimonioLiquido > 0 ? "success" : "danger"}
            trend={getTrend(data1.patrimonioLiquido, data2.patrimonioLiquido)}
            descricao="Sua riqueza real após subtrair tudo o que você deve de tudo o que você tem."
            formula="Ativos Totais - Passivos Totais"
            icon={<Wallet className="w-4 h-4" />}
          />
          <DetailedIndicatorBadge
            title="Retorno sobre Ativos"
            value={formatPercent((data1.receitas - data1.despesasTotais) / (data1.totalAtivos || 1) * 100)}
            status="neutral"
            descricao="Eficiência do seu patrimônio em gerar excedente financeiro."
            formula="(Resultado Líquido / Ativo Total) × 100"
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>
      </ExpandablePanel>
    </div>
  );
}