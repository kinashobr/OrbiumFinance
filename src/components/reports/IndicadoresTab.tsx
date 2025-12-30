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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, parseDateLocal } from "@/lib/utils";
import { addMonths, isBefore, isAfter, isSameDay, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { ComparisonDateRanges, DateRange } from "@/types/finance";

interface IndicatorGroupProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function IndicatorGroup({ title, subtitle, icon, children, className }: IndicatorGroupProps) {
  return (
    <ExpandablePanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      className={className}
      defaultExpanded={true}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </ExpandablePanel>
  );
}

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
  RECEITAS: "Total de receitas no período",
  DESPESAS: "Total de despesas no período",
  LUCRO: "Saldo operacional (Receitas - Despesas)",
  ATIVOS: "Total de ativos na data final",
  PASSIVOS: "Total de passivos na data final",
  PL: "Patrimônio Líquido",
  CAIXA: "Saldo disponível em contas líquidas",
  DIVIDAS: "Saldo devedor total (Empréstimos + Cartões)",
  INVESTIMENTOS: "Saldo total em investimentos",
  RENDIMENTOS: "Rendimentos de investimentos no período",
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
    } catch {
      return [];
    }
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIndicator, setNewIndicator] = useState<Partial<CustomIndicator>>({
    nome: '',
    descricao: '',
    formula: '',
    formato: 'percent',
    limiteVerde: 0,
    limiteAmarelo: 0,
    invertido: false,
  });

  const evaluateFormula = useCallback((formula: string, variables: Record<string, number>): number => {
    try {
      const sanitizedFormula = formula.replace(/[^0-9a-zA-Z\s\+\-\*\/\(\)\.]/g, '');
      const keys = Object.keys(variables);
      const values = Object.values(variables);
      const dynamicFn = new Function(...keys, `return (${sanitizedFormula})`);
      const result = dynamicFn(...values);
      return isFinite(result) ? result : 0;
    } catch (e) {
      return 0;
    }
  }, []);

  const determineStatus = useCallback((value: number, config: CustomIndicator): IndicatorStatus => {
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

  const saveCustomIndicators = (indicators: CustomIndicator[]) => {
    setCustomIndicators(indicators);
    localStorage.setItem(CUSTOM_INDICATORS_KEY, JSON.stringify(indicators));
  };

  const handleAddIndicator = () => {
    if (!newIndicator.nome || !newIndicator.formula) {
      toast.error("Nome e fórmula são obrigatórios");
      return;
    }

    const indicator: CustomIndicator = {
      id: `custom_${Date.now()}`,
      nome: newIndicator.nome || '',
      descricao: newIndicator.descricao || '',
      formula: newIndicator.formula || '',
      formato: (newIndicator.formato as any) || 'percent',
      limiteVerde: Number(newIndicator.limiteVerde) || 0,
      limiteAmarelo: Number(newIndicator.limiteAmarelo) || 0,
      invertido: !!newIndicator.invertido,
    };

    saveCustomIndicators([...customIndicators, indicator]);
    handleReset();
    toast.success("Indicador personalizado criado!");
  };

  const handleRemoveIndicator = (id: string) => {
    saveCustomIndicators(customIndicators.filter(i => i.id !== id));
    toast.success("Indicador removido");
  };
  
  const handleReset = () => {
    setNewIndicator({
      nome: '',
      descricao: '',
      formula: '',
      formato: 'percent',
      limiteVerde: 0,
      limiteAmarelo: 0,
      invertido: false,
    });
    setDialogOpen(false);
  };

  const calculateIndicatorsForRange = useCallback((range: DateRange) => {
    const finalDate = range.to || new Date(9999, 11, 31);
    
    const transacoesPeriodo = transacoesV2.filter(t => {
      if (!range.from || !range.to) return true;
      try {
        const dataT = parseDateLocal(t.date);
        return isWithinInterval(dataT, { start: startOfDay(range.from!), end: endOfDay(range.to!) });
      } catch {
        return false;
      }
    });
    
    const saldosPorConta = contasMovimento.map(c => ({
        ...c,
        saldo: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento)
    }));
    
    const contasLiquidas = saldosPorConta.filter(c => 
      ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)
    );
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

    const receitasMesAtual = transacoesPeriodo
      .filter(t => t.operationType !== 'initial_balance' && (t.operationType === 'receita' || t.operationType === 'rendimento'))
      .reduce((acc, t) => acc + t.amount, 0);
      
    const rendimentosInvestimentos = transacoesPeriodo
      .filter(t => t.operationType === 'rendimento')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const despesasMesAtualCash = transacoesPeriodo
      .filter(t => t.operationType !== 'initial_balance' && t.flow === 'out')
      .reduce((acc, t) => acc + t.amount, 0);

    const variables = {
      RECEITAS: receitasMesAtual,
      DESPESAS: despesasMesAtualCash,
      LUCRO: receitasMesAtual - despesasMesAtualCash,
      ATIVOS: totalAtivos,
      PASSIVOS: totalPassivos,
      PL: patrimonioLiquido,
      CAIXA: caixaTotal,
      DIVIDAS: saldoDevedor,
      INVESTIMENTOS: totalInvestimentos,
      RENDIMENTOS: rendimentosInvestimentos,
    };

    const liquidezCorrente = passivoCurtoPrazo > 0 ? caixaTotal / passivoCurtoPrazo : caixaTotal > 0 ? 999 : 0;
    const liquidezGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : totalAtivos > 0 ? 999 : 0;
    const solvenciaImediata = despesasMesAtualCash > 0 ? contaCorrentePura / (despesasMesAtualCash / 30) : 999;

    const endividamentoTotal = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
    const dividaPL = patrimonioLiquido > 0 ? (saldoDevedor / patrimonioLiquido) * 100 : 0;
    const imobilizacaoPL = patrimonioLiquido > 0 ? (valorVeiculos / patrimonioLiquido) * 100 : 0;

    const margemLiquida = receitasMesAtual > 0 ? ((receitasMesAtual - despesasMesAtualCash) / receitasMesAtual) * 100 : 0;
    const liberdadeFinanceira = despesasMesAtualCash > 0 ? (rendimentosInvestimentos / despesasMesAtualCash) * 100 : 0;

    const burnRate = receitasMesAtual > 0 ? (despesasMesAtualCash / receitasMesAtual) * 100 : 0;
    const mesesSobrevivencia = despesasMesAtualCash > 0 ? caixaTotal / (despesasMesAtualCash / 30) : 999;
    const margemSeguranca = receitasMesAtual > 0 ? ((receitasMesAtual - despesasMesAtualCash) / receitasMesAtual) * 100 : 0;

    const calculatedCustoms = customIndicators.map(ci => {
      const value = evaluateFormula(ci.formula, variables);
      return {
        ...ci,
        calculatedValue: value,
        status: determineStatus(value, ci)
      };
    });

    return {
      liquidez: {
        corrente: { valor: liquidezCorrente, status: (liquidezCorrente >= 1.5 ? "success" : liquidezCorrente >= 1 ? "warning" : "danger") as IndicatorStatus },
        seca: { valor: liquidezCorrente * 0.8, status: "neutral" as IndicatorStatus },
        imediata: { valor: liquidezCorrente * 0.5, status: "neutral" as IndicatorStatus },
        geral: { valor: liquidezGeral, status: (liquidezGeral >= 2 ? "success" : liquidezGeral >= 1 ? "warning" : "danger") as IndicatorStatus },
        solvenciaImediata: { valor: solvenciaImediata, status: (solvenciaImediata >= 1 ? "success" : solvenciaImediata >= 0.5 ? "warning" : "danger") as IndicatorStatus },
      },
      endividamento: {
        total: { valor: endividamentoTotal, status: (endividamentoTotal < 30 ? "success" : endividamentoTotal < 50 ? "warning" : "danger") as IndicatorStatus },
        dividaPL: { valor: dividaPL, status: (dividaPL < 50 ? "success" : dividaPL < 100 ? "warning" : "danger") as IndicatorStatus },
        composicao: { valor: 50, status: "neutral" as IndicatorStatus },
        imobilizacao: { valor: imobilizacaoPL, status: (imobilizacaoPL < 30 ? "success" : imobilizacaoPL < 50 ? "warning" : "danger") as IndicatorStatus },
      },
      rentabilidade: {
        margemLiquida: { valor: margemLiquida, status: (margemLiquida >= 20 ? "success" : margemLiquida >= 10 ? "warning" : "danger") as IndicatorStatus },
        retornoAtivos: { valor: 10, status: "neutral" as IndicatorStatus },
        retornoPL: { valor: 15, status: "neutral" as IndicatorStatus },
        liberdadeFinanceira: { valor: liberdadeFinanceira, status: (liberdadeFinanceira >= 100 ? "success" : liberdadeFinanceira >= 20 ? "warning" : "danger") as IndicatorStatus },
      },
      eficiencia: {
        despesasFixas: { valor: 40, status: "neutral" as IndicatorStatus },
        operacional: { valor: burnRate, status: (burnRate < 70 ? "success" : burnRate < 85 ? "warning" : "danger") as IndicatorStatus },
        burnRate: { valor: burnRate, status: (burnRate < 70 ? "success" : burnRate < 90 ? "warning" : "danger") as IndicatorStatus },
      },
      pessoais: {
        custoVida: { valor: despesasMesAtualCash, status: "neutral" as IndicatorStatus },
        mesesSobrevivencia: { valor: mesesSobrevivencia, status: (mesesSobrevivencia >= 6 ? "success" : mesesSobrevivencia >= 3 ? "warning" : "danger") as IndicatorStatus },
        taxaPoupanca: { valor: margemSeguranca, status: (margemSeguranca >= 20 ? "success" : margemSeguranca >= 10 ? "warning" : "danger") as IndicatorStatus },
        comprometimento: { valor: burnRate, status: (burnRate < 70 ? "success" : burnRate < 90 ? "warning" : "danger") as IndicatorStatus },
        margemSeguranca: { valor: margemSeguranca, status: (margemSeguranca >= 20 ? "success" : margemSeguranca >= 5 ? "warning" : "danger") as IndicatorStatus },
      },
      custom: calculatedCustoms,
    };
  }, [transacoesV2, contasMovimento, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSaldoDevedor, calculateBalanceUpToDate, calculateLoanPrincipalDueInNextMonths, calculateTotalInvestmentBalanceAtDate, segurosVeiculo, customIndicators, evaluateFormula, determineStatus]);

  const indicadores1 = useMemo(() => calculateIndicatorsForRange(range1), [calculateIndicatorsForRange, range1]);
  const indicadores2 = useMemo(() => calculateIndicatorsForRange(range2), [calculateIndicatorsForRange, range2]);

  const calculatePercentChange = useCallback((value1: number, value2: number) => {
    if (value2 === 0) return 0;
    return ((value1 - value2) / Math.abs(value2)) * 100;
  }, []);

  const getDisplayTrend = useCallback((key: string, group: string): { trend: "up" | "down" | "stable", percent: number, status: IndicatorStatus } => {
    const val1 = group === 'custom' 
      ? indicadores1.custom.find(c => c.id === key)?.calculatedValue || 0
      : (indicadores1 as any)[group][key].valor;
      
    const val2 = group === 'custom'
      ? indicadores2.custom.find(c => c.id === key)?.calculatedValue || 0
      : (indicadores2 as any)[group][key].valor;

    if (!range2.from || val2 === 0) return { trend: "stable", percent: 0, status: "neutral" };
    
    const percent = calculatePercentChange(val1, val2);
    const trend: "up" | "down" | "stable" = percent >= 0 ? "up" : "down";
    const status = group === 'custom'
      ? indicadores1.custom.find(c => c.id === key)?.status || "neutral"
      : (indicadores1 as any)[group][key].status;

    return { trend, percent, status };
  }, [indicadores1, indicadores2, range2.from, calculatePercentChange]);

  const formatValue = (value: number, formato: string) => {
    switch (formato) {
      case 'percent': return `${value.toFixed(1)}%`;
      case 'ratio': return value >= 999 ? "∞" : `${value.toFixed(2)}x`;
      case 'currency': return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
      default: return value.toFixed(2);
    }
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatRatio = (value: number) => value >= 999 ? "∞" : `${value.toFixed(2)}x`;
  const formatMeses = (value: number) => value >= 999 ? "∞" : `${value.toFixed(1)} meses`;

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-sm font-medium text-muted-foreground">Legenda:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Saudável</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-sm text-muted-foreground">Atenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Crítico</span>
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Indicador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Indicador Personalizado</DialogTitle>
              <DialogDescription>
                Defina um novo indicador financeiro usando variáveis do sistema e fórmulas matemáticas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do Indicador</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Taxa de Economia"
                    value={newIndicator.nome}
                    onChange={(e) => setNewIndicator({ ...newIndicator, nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="formato">Formato de Exibição</Label>
                  <Select 
                    value={newIndicator.formato} 
                    onValueChange={(v) => setNewIndicator({ ...newIndicator, formato: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="ratio">Razão (x)</SelectItem>
                      <SelectItem value="currency">Moeda (R$)</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="formula">Fórmula Matemática</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50/50">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Variáveis Disponíveis</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0 shadow-2xl border-border/50">
                      <div className="bg-muted/30 p-3 border-b border-border/50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Dicionário de Variáveis
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Clique em uma variável para entender o que ela representa.
                        </p>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto p-2">
                        <div className="grid gap-1">
                          {Object.entries(FORMULA_VARIABLES).map(([key, desc]) => (
                            <div key={key} className="p-2 rounded-md hover:bg-muted/50 transition-colors group">
                              <div className="flex items-center justify-between mb-0.5">
                                <code className="text-blue-500 font-bold text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                                  {key}
                                </code>
                                <HelpCircle className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <span className="text-[10px] text-muted-foreground leading-tight block">
                                {desc}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 bg-muted/20 border-t border-border/50">
                        <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Exemplo de Fórmula:</div>
                        <code className="text-[10px] block bg-background border border-border/50 p-1.5 rounded text-primary">
                          (RECEITAS - DESPESAS) / RECEITAS * 100
                        </code>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="formula"
                  placeholder="Ex: (RECEITAS - DESPESAS) / RECEITAS * 100"
                  value={newIndicator.formula}
                  onChange={(e) => setNewIndicator({ ...newIndicator, formula: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label className="text-success">Limite Saudável</Label>
                  <Input
                    type="number"
                    value={newIndicator.limiteVerde}
                    onChange={(e) => setNewIndicator({ ...newIndicator, limiteVerde: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-warning">Limite Atenção</Label>
                  <Input
                    type="number"
                    value={newIndicator.limiteAmarelo}
                    onChange={(e) => setNewIndicator({ ...newIndicator, limiteAmarelo: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de Lógica</Label>
                  <Select 
                    value={newIndicator.invertido ? "true" : "false"} 
                    onValueChange={(v) => setNewIndicator({ ...newIndicator, invertido: v === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Maior é melhor</SelectItem>
                      <SelectItem value="true">Menor é melhor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="descricao">Descrição (Aparece no Tooltip)</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o que este indicador mede..."
                  value={newIndicator.descricao}
                  onChange={(e) => setNewIndicator({ ...newIndicator, descricao: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button onClick={handleAddIndicator} className="gap-2">
                <Save className="w-4 h-4" />
                Salvar Indicador
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {indicadores1.custom.length > 0 && (
        <IndicatorGroup
          title="Indicadores Personalizados"
          subtitle="Métricas definidas pelo usuário"
          icon={<Settings className="w-4 h-4" />}
        >
          {indicadores1.custom.map((ci) => (
            <div key={ci.id} className="relative group/badge">
              <DetailedIndicatorBadge
                title={ci.nome}
                value={formatValue(ci.calculatedValue, ci.formato)}
                status={ci.status}
                trend={getDisplayTrend(ci.id, 'custom').trend}
                trendLabel={range2.from ? `${getDisplayTrend(ci.id, 'custom').percent.toFixed(1)}% vs anterior` : undefined}
                descricao={ci.descricao}
                formula={ci.formula}
                sparklineData={generateSparkline(ci.calculatedValue, getDisplayTrend(ci.id, 'custom').trend)}
                icon={<Activity className="w-4 h-4" />}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/badge:opacity-100 transition-opacity z-10 shadow-sm"
                onClick={() => handleRemoveIndicator(ci.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </IndicatorGroup>
      )}

      <IndicatorGroup
        title="Indicadores de Liquidez"
        subtitle="Capacidade de pagamento de curto prazo"
        icon={<Droplets className="w-4 h-4" />}
      >
        <DetailedIndicatorBadge
          title="Liquidez Corrente"
          value={formatRatio(indicadores1.liquidez.corrente.valor)}
          status={indicadores1.liquidez.corrente.status}
          trend={getDisplayTrend('corrente', 'liquidez').trend}
          trendLabel={range2.from ? `${getDisplayTrend('corrente', 'liquidez').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Mede a capacidade de pagar obrigações de curto prazo com ativos circulantes. Valor ideal: acima de 1.5x"
          formula="Ativo Circulante / Passivo Circulante (12 meses)"
          sparklineData={generateSparkline(indicadores1.liquidez.corrente.valor, getDisplayTrend('corrente', 'liquidez').trend)}
          icon={<Droplets className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Solvência Imediata"
          value={formatRatio(indicadores1.liquidez.solvenciaImediata.valor)}
          status={indicadores1.liquidez.solvenciaImediata.status}
          trend={getDisplayTrend('solvenciaImediata', 'liquidez').trend}
          trendLabel={range2.from ? `${getDisplayTrend('solvenciaImediata', 'liquidez').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Capacidade de cobrir dívidas imediatas e gastos do mês apenas com saldo em conta corrente. Ideal: acima de 1x"
          formula="Saldo Conta Corrente / (Dívidas Cartão + Gastos Médios Mês)"
          sparklineData={generateSparkline(indicadores1.liquidez.solvenciaImediata.valor, getDisplayTrend('solvenciaImediata', 'liquidez').trend)}
          icon={<Zap className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Liquidez Geral"
          value={formatRatio(indicadores1.liquidez.geral.valor)}
          status={indicadores1.liquidez.geral.status}
          trend={getDisplayTrend('geral', 'liquidez').trend}
          trendLabel={range2.from ? `${getDisplayTrend('geral', 'liquidez').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Capacidade de pagar todas as dívidas com todos os ativos. Visão de longo prazo. Ideal: acima de 2x"
          formula="Ativo Total / Passivo Total (na data final)"
          sparklineData={generateSparkline(indicadores1.liquidez.geral.valor, getDisplayTrend('geral', 'liquidez').trend)}
          icon={<Shield className="w-4 h-4" />}
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Endividamento"
        subtitle="Nível de comprometimento com dívidas"
        icon={<Shield className="w-4 h-4" />}
      >
        <DetailedIndicatorBadge
          title="Endividamento Total"
          value={formatPercent(indicadores1.endividamento.total.valor)}
          status={indicadores1.endividamento.total.status}
          trend={getDisplayTrend('total', 'endividamento').trend}
          trendLabel={range2.from ? `${getDisplayTrend('total', 'endividamento').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Percentual dos ativos financiados por terceiros (dívidas). Quanto menor, melhor. Ideal: abaixo de 30%"
          formula="(Passivo Total / Ativo Total) × 100 (na data final)"
          sparklineData={generateSparkline(indicadores1.endividamento.total.valor, getDisplayTrend('total', 'endividamento').trend)}
          icon={<Shield className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Dívida / Patrimônio"
          value={formatPercent(indicadores1.endividamento.dividaPL.valor)}
          status={indicadores1.endividamento.dividaPL.status}
          trend={getDisplayTrend('dividaPL', 'endividamento').trend}
          trendLabel={range2.from ? `${getDisplayTrend('dividaPL', 'endividamento').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Relação entre capital de terceiros e capital próprio. Indica alavancagem. Ideal: abaixo de 50%"
          formula="(Dívida Total / Patrimônio Líquido) × 100 (na data final)"
          sparklineData={generateSparkline(indicadores1.endividamento.dividaPL.valor, getDisplayTrend('dividaPL', 'endividamento').trend)}
          icon={<Shield className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Imobilização do PL"
          value={formatPercent(indicadores1.endividamento.imobilizacao.valor)}
          status={indicadores1.endividamento.imobilizacao.status}
          trend={getDisplayTrend('imobilizacao', 'endividamento').trend}
          trendLabel={range2.from ? `${getDisplayTrend('imobilizacao', 'endividamento').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Quanto do patrimônio está investido em bens imobilizados (veículos). Ideal: abaixo de 30%"
          formula="(Ativo Imobilizado / Patrimônio Líquido) × 100 (na data final)"
          sparklineData={generateSparkline(indicadores1.endividamento.imobilizacao.valor, getDisplayTrend('imobilizacao', 'endividamento').trend)}
          icon={<Activity className="w-4 h-4" />}
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Rentabilidade"
        subtitle="Retorno sobre recursos"
        icon={<TrendingUp className="w-4 h-4" />}
      >
        <DetailedIndicatorBadge
          title="Margem Líquida"
          value={formatPercent(indicadores1.rentabilidade.margemLiquida.valor)}
          status={indicadores1.rentabilidade.margemLiquida.status}
          trend={getDisplayTrend('margemLiquida', 'rentabilidade').trend}
          trendLabel={range2.from ? `${getDisplayTrend('margemLiquida', 'rentabilidade').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Percentual das receitas que sobra como lucro. Mede eficiência na conversão de receita em resultado. Ideal: acima de 20%"
          formula="(Resultado Líquido / Receitas) × 100 (no período)"
          sparklineData={generateSparkline(indicadores1.rentabilidade.margemLiquida.valor, getDisplayTrend('margemLiquida', 'rentabilidade').trend)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Liberdade Financeira"
          value={formatPercent(indicadores1.rentabilidade.liberdadeFinanceira.valor)}
          status={indicadores1.rentabilidade.liberdadeFinanceira.status}
          trend={getDisplayTrend('liberdadeFinanceira', 'rentabilidade').trend}
          trendLabel={range2.from ? `${getDisplayTrend('liberdadeFinanceira', 'rentabilidade').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Percentual das despesas cobertas por rendimentos passivos. 100% significa independência financeira."
          formula="(Rendimentos de Investimentos / Despesas Totais) × 100"
          sparklineData={generateSparkline(indicadores1.rentabilidade.liberdadeFinanceira.valor, getDisplayTrend('liberdadeFinanceira', 'rentabilidade').trend)}
          icon={<Anchor className="w-4 h-4" />}
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Eficiência"
        subtitle="Otimização de recursos"
        icon={<Gauge className="w-4 h-4" />}
      >
        <DetailedIndicatorBadge
          title="Burn Rate (Consumo)"
          value={formatPercent(indicadores1.eficiencia.burnRate.valor)}
          status={indicadores1.eficiencia.burnRate.status}
          trend={getDisplayTrend('burnRate', 'eficiencia').trend}
          trendLabel={range2.from ? `${getDisplayTrend('burnRate', 'eficiencia').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Velocidade com que você consome sua receita mensal. Ideal: abaixo de 70%"
          formula="(Despesas Totais / Receitas Totais) × 100"
          sparklineData={generateSparkline(indicadores1.eficiencia.burnRate.valor, getDisplayTrend('burnRate', 'eficiencia').trend)}
          icon={<Flame className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Eficiência Operacional"
          value={formatPercent(indicadores1.eficiencia.operacional.valor)}
          status={indicadores1.eficiencia.operacional.status}
          trend={getDisplayTrend('operacional', 'eficiencia').trend}
          trendLabel={range2.from ? `${getDisplayTrend('operacional', 'eficiencia').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Percentual das receitas consumidas por despesas. Menor valor indica maior eficiência. Ideal: abaixo de 70%"
          formula="(Despesas Totais / Receitas) × 100 (no período)"
          sparklineData={generateSparkline(indicadores1.eficiencia.operacional.valor, getDisplayTrend('operacional', 'eficiencia').trend)}
          icon={<Activity className="w-4 h-4" />}
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores Pessoais"
        subtitle="Saúde financeira individual"
        icon={<Activity className="w-4 h-4" />}
      >
        <DetailedIndicatorBadge
          title="Margem de Segurança"
          value={formatPercent(indicadores1.pessoais.margemSeguranca.valor)}
          status={indicadores1.pessoais.margemSeguranca.status}
          trend={getDisplayTrend('margemSeguranca', 'pessoais').trend}
          trendLabel={range2.from ? `${getDisplayTrend('margemSeguranca', 'pessoais').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Percentual da receita que sobra livre após todos os gastos e parcelas. Ideal: acima de 20%"
          formula="((Receita - Despesas - Parcelas) / Receita) × 100"
          sparklineData={generateSparkline(indicadores1.pessoais.margemSeguranca.valor, getDisplayTrend('margemSeguranca', 'pessoais').trend)}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <DetailedIndicatorBadge
          title="Meses de Sobrevivência"
          value={formatMeses(indicadores1.pessoais.mesesSobrevivencia.valor)}
          status={indicadores1.pessoais.mesesSobrevivencia.status}
          trend={getDisplayTrend('mesesSobrevivencia', 'pessoais').trend}
          trendLabel={range2.from ? `${getDisplayTrend('mesesSobrevivencia', 'pessoais').percent.toFixed(1)}% vs anterior` : undefined}
          descricao="Quantos meses você consegue manter seu padrão de vida apenas com reservas. Ideal: acima de 6 meses"
          formula="Caixa e Equivalentes / Custo de Vida Mensal"
          sparklineData={generateSparkline(indicadores1.pessoais.mesesSobrevivencia.valor, getDisplayTrend('mesesSobrevivencia', 'pessoais').trend)}
          icon={<Calculator className="w-4 h-4" />}
        />
      </IndicatorGroup>
    </div>
  );
}