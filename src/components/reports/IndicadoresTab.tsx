"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Droplets,
  Shield,
  TrendingUp,
  Gauge,
  Activity,
  ShieldCheck,
  Calculator,
  Plus,
  Save,
  Trash2,
  Zap,
  Flame,
  Anchor,
  Settings,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ExpandablePanel } from "./ExpandablePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReportCard } from "./ReportCard";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, parseDateLocal } from "@/lib/utils";
import { addMonths, isBefore, isAfter, isSameDay, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ComparisonDateRanges, DateRange } from "@/types/finance";
import { Badge } from "@/components/ui/badge";

interface CustomIndicator {
  id: string;
  nome: string;
  descricao: string;
  formula: string;
  formato: 'percent' | 'ratio' | 'currency' | 'number';
  limiteVerde: number;
  limiteAmarelo: number;
  invertido: boolean;
}

type IndicatorStatus = "success" | "warning" | "danger" | "neutral";

const CUSTOM_INDICATORS_KEY = "fin_custom_indicators_v1";

interface IndicadoresTabProps {
  dateRanges: ComparisonDateRanges;
}

const FORMULA_VARIABLES = {
  RECEITAS: "Total que entrou no período selecionado",
  DESPESAS: "Total que saiu no período selecionado",
  LUCRO: "Sobra de caixa (Receitas menos Despesas)",
  PAGAMENTOS_DIVIDA: "Total pago em parcelas de empréstimos no período",
  RENDIMENTOS: "Ganhos vindo de investimentos no período",
  ATIVOS: "Valor total de tudo o que você possui hoje",
  PASSIVOS: "Valor total de tudo o que você deve hoje",
  PL: "Sua riqueza real (O que você tem menos o que deve)",
  CAIXA: "Dinheiro disponível em suas contas agora",
  DIVIDAS_TOTAL: "Total de dívidas que ainda faltam pagar",
  INVESTIMENTOS_TOTAL: "Total que você tem aplicado atualmente",
};

export function IndicadoresTab({ dateRanges }: IndicadoresTabProps) {
  const {
    transacoesV2,
    contasMovimento,
    veiculos,
    categoriasV2,
    segurosVeiculo,
    getAtivosTotal,
    getPassivosTotal,
    getSaldoDevedor,
    calculateBalanceUpToDate,
    getValorFipeTotal,
    getSegurosAPagar,
    calculateLoanPrincipalDueInNextMonths,
    calculateTotalInvestmentBalanceAtDate,
  } = useFinance();

  const { range1, range2 } = dateRanges;

  const [customIndicators, setCustomIndicators] = useState<CustomIndicator[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_INDICATORS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIndicator, setNewIndicator] = useState<Partial<CustomIndicator>>({
    nome: '', descricao: '', formula: '', formato: 'percent', limiteVerde: 0, limiteAmarelo: 0, invertido: false,
  });

  const evaluateFormula = useCallback((formula: string, variables: Record<string, number>): number => {
    try {
      let processedFormula = formula.toUpperCase();
      const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
      sortedKeys.forEach(key => {
        const value = variables[key];
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        processedFormula = processedFormula.replace(regex, value.toString());
      });
      const sanitizedFormula = processedFormula.replace(/[^0-9\s\+\-\*\/\(\)\.]/g, '');
      const result = new Function(`return (${sanitizedFormula})`)();
      return isFinite(result) ? result : 0;
    } catch { return 0; }
  }, []);

  const determineStatus = useCallback((value: number, config: any): IndicatorStatus => {
    const { limiteVerde, limiteAmarelo, invertido } = config;
    if (invertido) {
      if (value <= limiteVerde) return "success";
      if (value <= limiteAmarelo) return "warning";
      return "danger";
    } else {
      if (value >= limiteVerde) return "success";
      if (value >= limiteAmarelo) return "warning";
      return "danger";
    }
  }, []);

  const calculateIndicatorsForRange = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date(9999, 11, 31);
    const transacoesPeriodo = transacoesV2.filter(t => {
      if (!range.from || !range.to) return true;
      try {
        const dataT = parseDateLocal(t.date);
        return isWithinInterval(dataT, { start: startOfDay(range.from!), end: endOfDay(range.to!) });
      } catch { return false; }
    });
    
    const saldosPorConta = contasMovimento.map(c => ({
        ...c, saldo: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento)
    }));
    
    const contasLiquidas = saldosPorConta.filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType));
    const caixaTotal = contasLiquidas.reduce((acc, c) => acc + Math.max(0, c.saldo), 0);
    const contaCorrentePura = saldosPorConta.filter(c => c.accountType === 'corrente').reduce((acc, c) => acc + Math.max(0, c.saldo), 0);

    const totalAtivos = getAtivosTotal(finalDate);
    const totalPassivos = getPassivosTotal(finalDate);
    const patrimonioLiquido = totalAtivos - totalPassivos;
    const valorVeiculos = getValorFipeTotal(finalDate);
    const saldoDevedor = getSaldoDevedor(finalDate);
    const totalInvestimentos = calculateTotalInvestmentBalanceAtDate(finalDate);
    
    const loanPrincipalShortTerm = calculateLoanPrincipalDueInNextMonths(finalDate, 12);
    let segurosAPagarShortTerm = 0;
    const lookaheadDate = addMonths(finalDate, 12);
    segurosVeiculo.forEach(seguro => {
        seguro.parcelas.forEach(parcela => {
            const dueDate = parseDateLocal(parcela.vencimento);
            if (!parcela.paga && (isBefore(dueDate, lookaheadDate) || isSameDay(dueDate, lookaheadDate)) && isAfter(dueDate, finalDate)) {
                segurosAPagarShortTerm += parcela.valor;
            }
        });
    });
    
    const passivoCurtoPrazo = loanPrincipalShortTerm + segurosAPagarShortTerm; 
    const receitasMesAtual = transacoesPeriodo.filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento')).reduce((acc, t) => acc + t.amount, 0);
    const rendimentosInvestimentos = transacoesPeriodo.filter(t => t.operationType === 'rendimento').reduce((acc, t) => acc + t.amount, 0);
    const despesasMesAtualCash = transacoesPeriodo.filter(t => t.operationType !== 'initial_balance' && t.flow === 'out').reduce((acc, t) => acc + t.amount, 0);
    const lucroPeriodo = receitasMesAtual - despesasMesAtualCash;

    const variables = {
      RECEITAS: receitasMesAtual, DESPESAS: despesasMesAtualCash, LUCRO: lucroPeriodo, PAGAMENTOS_DIVIDA: 0, RENDIMENTOS: rendimentosInvestimentos, ATIVOS: totalAtivos, PASSIVOS: totalPassivos, PL: patrimonioLiquido, CAIXA: caixaTotal, DIVIDAS_TOTAL: saldoDevedor, INVESTIMENTOS_TOTAL: totalInvestimentos,
    };

    const calculatedCustoms = customIndicators.map(ci => {
      const value = evaluateFormula(ci.formula, variables);
      return { ...ci, calculatedValue: value, status: determineStatus(value, ci) };
    });

    return {
      liquidez: {
        corrente: { valor: passivoCurtoPrazo > 0 ? caixaTotal / passivoCurtoPrazo : 999, status: determineStatus(passivoCurtoPrazo > 0 ? caixaTotal / passivoCurtoPrazo : 999, { limiteVerde: 1.5, limiteAmarelo: 1, invertido: false }) },
        geral: { valor: totalPassivos > 0 ? totalAtivos / totalPassivos : 999, status: determineStatus(totalPassivos > 0 ? totalAtivos / totalPassivos : 999, { limiteVerde: 2, limiteAmarelo: 1.2, invertido: false }) },
      },
      endividamento: {
        total: { valor: totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0, status: determineStatus(totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0, { limiteVerde: 30, limiteAmarelo: 50, invertido: true }) },
        dividaPL: { valor: patrimonioLiquido > 0 ? (saldoDevedor / patrimonioLiquido) * 100 : 0, status: determineStatus(patrimonioLiquido > 0 ? (saldoDevedor / patrimonioLiquido) * 100 : 0, { limiteVerde: 50, limiteAmarelo: 80, invertido: true }) },
      },
      rentabilidade: {
        margemLiquida: { valor: receitasMesAtual > 0 ? (lucroPeriodo / receitasMesAtual) * 100 : 0, status: determineStatus(receitasMesAtual > 0 ? (lucroPeriodo / receitasMesAtual) * 100 : 0, { limiteVerde: 20, limiteAmarelo: 10, invertido: false }) },
      },
      custom: calculatedCustoms,
    };
  }, [transacoesV2, contasMovimento, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSaldoDevedor, calculateBalanceUpToDate, calculateLoanPrincipalDueInNextMonths, calculateTotalInvestmentBalanceAtDate, segurosVeiculo, customIndicators, evaluateFormula, determineStatus]);

  const indicadores1 = useMemo(() => calculateIndicatorsForRange(range1), [calculateIndicatorsForRange, range1]);
  const indicadores2 = useMemo(() => calculateIndicatorsForRange(range2), [calculateIndicatorsForRange, range2]);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatRatio = (value: number) => value >= 999 ? "∞" : `${value.toFixed(2)}x`;

  return (
    <div className="space-y-10">
      {/* Header de Indicadores com FAB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-sm">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-black text-2xl text-foreground">Saúde Financeira</h3>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Métricas de Performance</p>
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full h-12 px-8 font-black text-sm gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" /> NOVO INDICADOR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-[2.5rem] p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Criar Indicador</DialogTitle>
              <DialogDescription className="font-bold text-muted-foreground text-xs uppercase tracking-widest">Personalize sua análise</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Nome</Label>
                <Input placeholder="Ex: Margem de Segurança" className="h-12 border-2 rounded-2xl font-bold" value={newIndicator.nome} onChange={e => setNewIndicator({...newIndicator, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Fórmula</Label>
                <Input placeholder="Ex: (LUCRO / RECEITAS) * 100" className="h-12 border-2 rounded-2xl font-black" value={newIndicator.formula} onChange={e => setNewIndicator({...newIndicator, formula: e.target.value.toUpperCase()})} />
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full h-14 rounded-2xl font-black text-base" onClick={() => { toast.success("Indicador criado!"); setDialogOpen(false); }}>SALVAR INDICADOR</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid de Indicadores Expressivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <ReportCard
          title="Liquidez Corrente"
          value={formatRatio(indicadores1.liquidez.corrente.valor)}
          status={indicadores1.liquidez.corrente.status}
          icon={<Droplets className="w-6 h-6" />}
          className="rounded-[2.5rem] p-10 border-l-8"
          tooltip="Capacidade de pagar dívidas de curto prazo. Ideal: > 1.5x"
        />
        <ReportCard
          title="Endividamento Total"
          value={formatPercent(indicadores1.endividamento.total.valor)}
          status={indicadores1.endividamento.total.status}
          icon={<Shield className="w-6 h-6" />}
          className="rounded-[2.5rem] p-10 border-l-8"
          tooltip="Percentual de ativos financiados por terceiros. Ideal: < 30%"
        />
        <ReportCard
          title="Margem Líquida"
          value={formatPercent(indicadores1.rentabilidade.margemLiquida.valor)}
          status={indicadores1.rentabilidade.margemLiquida.status}
          icon={<TrendingUp className="w-6 h-6" />}
          className="rounded-[2.5rem] p-10 border-l-8"
          tooltip="Percentual da receita que sobra como lucro. Ideal: > 20%"
        />
      </div>

      {/* Seção de Indicadores Customizados */}
      {indicadores1.custom.length > 0 && (
        <div className="space-y-8 pt-10 border-t border-border/40">
          <div className="flex items-center gap-4 px-2">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-2xl text-foreground">Meus Indicadores</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Métricas Personalizadas</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {indicadores1.custom.map(ci => (
              <ReportCard
                key={ci.id}
                title={ci.nome}
                value={ci.calculatedValue.toFixed(1) + (ci.formato === 'percent' ? '%' : '')}
                status={ci.status}
                icon={<Activity className="w-6 h-6" />}
                className="rounded-[2.5rem] p-10 border-l-8"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}