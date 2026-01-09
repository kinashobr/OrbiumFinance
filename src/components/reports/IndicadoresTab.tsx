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
      // Substitui nomes de variáveis por seus valores, tratando nomes longos primeiro
      let processedFormula = formula.toUpperCase();
      
      // Ordenar chaves por tamanho para evitar que DIVIDAS_TOTAL seja substituída por DIVIDAS + _TOTAL
      const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
      
      sortedKeys.forEach(key => {
        const value = variables[key];
        // Usa regex para garantir que substitua apenas a palavra exata
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        processedFormula = processedFormula.replace(regex, value.toString());
      });

      // Sanitização básica antes do eval
      const sanitizedFormula = processedFormula.replace(/[^0-9\s\+\-\*\/\(\)\.]/g, '');
      
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${sanitizedFormula})`)();
      return isFinite(result) ? result : 0;
    } catch (e) {
      console.error("Erro na fórmula:", e);
      return 0;
    }
  }, []);

  const determineStatus = useCallback((value: number, config: CustomIndicator | { limiteVerde: number, limiteAmarelo: number, invertido: boolean }): IndicatorStatus => {
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

    const pagamentosDividaPeriodo = transacoesPeriodo
      .filter(t => t.operationType === 'pagamento_emprestimo')
      .reduce((acc, t) => acc + t.amount, 0);

    const lucroPeriodo = receitasMesAtual - despesasMesAtualCash;

    // Métricas de Liquidez
    const liquidezCorrente = passivoCurtoPrazo > 0 ? caixaTotal / passivoCurtoPrazo : caixaTotal > 0 ? 999 : 0;
    const liquidezSeca = passivoCurtoPrazo > 0 ? (caixaTotal - totalInvestimentos * 0.3) / passivoCurtoPrazo : 0;
    const liquidezGeral = totalPassivos > 0 ? totalAtivos / totalPassivos : totalAtivos > 0 ? 999 : 0;
    const solvenciaImediata = despesasMesAtualCash > 0 ? contaCorrentePura / (despesasMesAtualCash / 30) : 999;

    // Métricas de Endividamento
    const endividamentoTotal = totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0;
    const dividaPL = patrimonioLiquido > 0 ? (saldoDevedor / patrimonioLiquido) * 100 : 0;
    const imobilizacaoPL = patrimonioLiquido > 0 ? (valorVeiculos / patrimonioLiquido) * 100 : 0;
    const composicaoEndividamento = totalPassivos > 0 ? (passivoCurtoPrazo / totalPassivos) * 100 : 0;

    // Métricas de Rentabilidade
    const margemLiquida = receitasMesAtual > 0 ? (lucroPeriodo / receitasMesAtual) * 100 : 0;
    const liberdadeFinanceira = despesasMesAtualCash > 0 ? (rendimentosInvestimentos / despesasMesAtualCash) * 100 : 0;
    const roa = totalAtivos > 0 ? (lucroPeriodo / totalAtivos) * 100 : 0;
    const roe = patrimonioLiquido > 0 ? (lucroPeriodo / patrimonioLiquido) * 100 : 0;

    // Métricas de Eficiência
    const despesasFixasTotal = transacoesPeriodo
      .filter(t => {
        const cat = categoriasV2.find(c => c.id === t.categoryId);
        return cat?.nature === 'despesa_fixa';
      })
      .reduce((acc, t) => acc + t.amount, 0);
    
    const participacaoFixas = receitasMesAtual > 0 ? (despesasFixasTotal / receitasMesAtual) * 100 : 0;
    const burnRate = receitasMesAtual > 0 ? (despesasMesAtualCash / receitasMesAtual) * 100 : 0;
    const mesesSobrevivencia = despesasMesAtualCash > 0 ? caixaTotal / (despesasMesAtualCash / 30) : 999;
    const margemSeguranca = receitasMesAtual > 0 ? (lucroPeriodo / receitasMesAtual) * 100 : 0;

    // NOVO: Dicionário de Variáveis para Fórmulas
    const variables = {
      RECEITAS: receitasMesAtual,
      DESPESAS: despesasMesAtualCash,
      LUCRO: lucroPeriodo,
      PAGAMENTOS_DIVIDA: pagamentosDividaPeriodo,
      RENDIMENTOS: rendimentosInvestimentos,
      ATIVOS: totalAtivos,
      PASSIVOS: totalPassivos,
      PL: patrimonioLiquido,
      CAIXA: caixaTotal,
      DIVIDAS_TOTAL: saldoDevedor,
      INVESTIMENTOS_TOTAL: totalInvestimentos,
    };

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
        corrente: { valor: liquidezCorrente, status: determineStatus(liquidezCorrente, { limiteVerde: 1.5, limiteAmarelo: 1, invertido: false }) },
        seca: { valor: Math.max(0, liquidezSeca), status: determineStatus(liquidezSeca, { limiteVerde: 1, limiteAmarelo: 0.8, invertido: false }) },
        geral: { valor: liquidezGeral, status: determineStatus(liquidezGeral, { limiteVerde: 2, limiteAmarelo: 1.2, invertido: false }) },
        solvenciaImediata: { valor: solvenciaImediata, status: determineStatus(solvenciaImediata, { limiteVerde: 1, limiteAmarelo: 0.5, invertido: false }) },
      },
      endividamento: {
        total: { valor: endividamentoTotal, status: determineStatus(endividamentoTotal, { limiteVerde: 30, limiteAmarelo: 50, invertido: true }) },
        dividaPL: { valor: dividaPL, status: determineStatus(dividaPL, { limiteVerde: 50, limiteAmarelo: 80, invertido: true }) },
        imobilizacao: { valor: imobilizacaoPL, status: determineStatus(imobilizacaoPL, { limiteVerde: 30, limiteAmarelo: 45, invertido: true }) },
        composicao: { valor: composicaoEndividamento, status: determineStatus(composicaoEndividamento, { limiteVerde: 30, limiteAmarelo: 50, invertido: true }) },
      },
      rentabilidade: {
        margemLiquida: { valor: margemLiquida, status: determineStatus(margemLiquida, { limiteVerde: 20, limiteAmarelo: 10, invertido: false }) },
        liberdadeFinanceira: { valor: liberdadeFinanceira, status: determineStatus(liberdadeFinanceira, { limiteVerde: 100, limiteAmarelo: 20, invertido: false }) },
        roa: { valor: roa, status: determineStatus(roa, { limiteVerde: 5, limiteAmarelo: 2, invertido: false }) },
        roe: { valor: roe, status: determineStatus(roe, { limiteVerde: 10, limiteAmarelo: 5, invertido: false }) },
      },
      eficiencia: {
        participacaoFixas: { valor: participacaoFixas, status: determineStatus(participacaoFixas, { limiteVerde: 40, limiteAmarelo: 60, invertido: true }) },
        burnRate: { valor: burnRate, status: determineStatus(burnRate, { limiteVerde: 70, limiteAmarelo: 90, invertido: true }) },
      },
      pessoais: {
        mesesSobrevivencia: { valor: mesesSobrevivencia, status: determineStatus(mesesSobrevivencia, { limiteVerde: 6, limiteAmarelo: 3, invertido: false }) },
        margemSeguranca: { valor: margemSeguranca, status: determineStatus(margemSeguranca, { limiteVerde: 20, limiteAmarelo: 10, invertido: false }) },
      },
      custom: calculatedCustoms,
    };
  }, [transacoesV2, contasMovimento, getAtivosTotal, getPassivosTotal, getValorFipeTotal, getSaldoDevedor, calculateBalanceUpToDate, calculateLoanPrincipalDueInNextMonths, calculateTotalInvestmentBalanceAtDate, segurosVeiculo, customIndicators, evaluateFormula, determineStatus, categoriasV2]);

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
              <DialogTitle>Criar Novo Indicador</DialogTitle>
              <DialogDescription>
                Crie suas próprias fórmulas matemáticas usando as variáveis do sistema para analisar seu patrimônio do seu jeito.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do Indicador</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Margem de Economia"
                    value={newIndicator.nome}
                    onChange={(e) => setNewIndicator({ ...newIndicator, nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="formato">Como exibir o resultado</Label>
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
                      <SelectItem value="number">Número Simples</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="formula">Fórmula do Indicador</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50/50">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Ver Variáveis</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0 shadow-2xl border-border/50">
                      <div className="bg-muted/30 p-3 border-b border-border/50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Quais dados posso usar?
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Escolha entre informações do mês selecionado ou saldos atuais.
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
                              </div>
                              <span className="text-[10px] text-muted-foreground leading-tight block">
                                {desc}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 bg-blue-500/5 border-t border-blue-500/10">
                        <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Dica Amigável:</div>
                        <p className="text-[10px] text-blue-600/80 leading-snug">
                          Exemplo: <code className="bg-white/50 px-1 rounded font-bold">(LUCRO / RECEITAS) * 100</code>
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="formula"
                  placeholder="Ex: (LUCRO / RECEITAS) * 100"
                  value={newIndicator.formula}
                  onChange={(e) => setNewIndicator({ ...newIndicator, formula: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label className="text-success">Meta (Saudável)</Label>
                  <Input
                    type="number"
                    value={newIndicator.limiteVerde}
                    onChange={(e) => setNewIndicator({ ...newIndicator, limiteVerde: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-warning">Alerta (Atenção)</Label>
                  <Input
                    type="number"
                    value={newIndicator.limiteAmarelo}
                    onChange={(e) => setNewIndicator({ ...newIndicator, limiteAmarelo: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Lógica da Cor</Label>
                  <Select 
                    value={newIndicator.invertido ? "true" : "false"} 
                    onValueChange={(v) => setNewIndicator({ ...newIndicator, invertido: v === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Quanto maior, melhor</SelectItem>
                      <SelectItem value="true">Quanto menor, melhor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="descricao">O que este indicador explica?</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva brevemente o que este número representa para você..."
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
                Criar Indicador
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {indicadores1.custom.length > 0 && (
        <IndicatorGroup
          title="Meus Indicadores"
          subtitle="Métricas criadas por você"
          icon={<Settings className="w-4 h-4" />}
        >
          {indicadores1.custom.map((ci) => (
            <div key={ci.id} className="relative group/badge">
              <ReportCard
                title={ci.nome}
                value={formatValue(ci.calculatedValue, ci.formato)}
                status={ci.status}
                trend={range2.from ? getDisplayTrend(ci.id, 'custom').percent : undefined}
                trendLabel={range2.from ? "período anterior" : undefined}
                tooltip={ci.descricao || ci.formula ? `${ci.descricao || ''}${ci.formula ? ` Fórmula: ${ci.formula}` : ''}` : undefined}
                icon={<Activity className="w-6 h-6" />}
                size="sm"
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
        <ReportCard
          title="Liquidez Corrente"
          value={formatRatio(indicadores1.liquidez.corrente.valor)}
          status={indicadores1.liquidez.corrente.status}
          trend={range2.from ? getDisplayTrend('corrente', 'liquidez').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Capacidade de pagar obrigações de curto prazo com ativos circulantes. Ideal: acima de 1.5x. Fórmula: Ativo Circulante / Passivo Circulante (12 meses)."
          icon={<Droplets className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Liquidez Seca"
          value={formatRatio(indicadores1.liquidez.seca.valor)}
          status={indicadores1.liquidez.seca.status}
          trend={range2.from ? getDisplayTrend('seca', 'liquidez').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Capacidade de cobrir dívidas imediatas removendo parte dos investimentos de menor liquidez. Fórmula: (Ativo Circulante - Investimentos Estáticos) / Passivo Circulante."
          icon={<Droplets className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Solvência Imediata"
          value={formatRatio(indicadores1.liquidez.solvenciaImediata.valor)}
          status={indicadores1.liquidez.solvenciaImediata.status}
          trend={range2.from ? getDisplayTrend('solvenciaImediata', 'liquidez').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Capacidade de cobrir dívidas imediatas e gastos do mês apenas com saldo em conta corrente. Ideal: acima de 1x."
          icon={<Zap className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Liquidez Geral"
          value={formatRatio(indicadores1.liquidez.geral.valor)}
          status={indicadores1.liquidez.geral.status}
          trend={range2.from ? getDisplayTrend('geral', 'liquidez').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Capacidade de pagar todas as dívidas com todos os ativos. Visão de longo prazo. Ideal: acima de 2x. Fórmula: Ativo Total / Passivo Total."
          icon={<Shield className="w-6 h-6" />}
          size="sm"
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Endividamento"
        subtitle="Nível de comprometimento com dívidas"
        icon={<Shield className="w-4 h-4" />}
      >
        <ReportCard
          title="Endividamento Total"
          value={formatPercent(indicadores1.endividamento.total.valor)}
          status={indicadores1.endividamento.total.status}
          trend={range2.from ? getDisplayTrend('total', 'endividamento').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Percentual dos ativos financiados por terceiros. Quanto menor, melhor. Ideal: abaixo de 30%. Fórmula: (Passivo Total / Ativo Total) × 100."
          icon={<Shield className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Dívida / Patrimônio"
          value={formatPercent(indicadores1.endividamento.dividaPL.valor)}
          status={indicadores1.endividamento.dividaPL.status}
          trend={range2.from ? getDisplayTrend('dividaPL', 'endividamento').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Relação entre capital de terceiros e capital próprio. Ideal: abaixo de 50%. Fórmula: (Dívida Total / Patrimônio Líquido) × 100."
          icon={<Shield className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Imobilização do PL"
          value={formatPercent(indicadores1.endividamento.imobilizacao.valor)}
          status={indicadores1.endividamento.imobilizacao.status}
          trend={range2.from ? getDisplayTrend('imobilizacao', 'endividamento').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Quanto do patrimônio está investido em bens imobilizados (veículos). Ideal: abaixo de 30%. Fórmula: (Ativo Imobilizado / Patrimônio Líquido) × 100."
          icon={<Activity className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Composição da Dívida"
          value={formatPercent(indicadores1.endividamento.composicao.valor)}
          status={indicadores1.endividamento.composicao.status}
          trend={range2.from ? getDisplayTrend('composicao', 'endividamento').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Quanto da dívida total vence no curto prazo (próximos 12 meses). Fórmula: (Passivo Circulante / Passivo Total) × 100."
          icon={<Calculator className="w-6 h-6" />}
          size="sm"
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Rentabilidade"
        subtitle="Retorno sobre recursos"
        icon={<TrendingUp className="w-4 h-4" />}
      >
        <ReportCard
          title="Margem Líquida"
          value={formatPercent(indicadores1.rentabilidade.margemLiquida.valor)}
          status={indicadores1.rentabilidade.margemLiquida.status}
          trend={range2.from ? getDisplayTrend('margemLiquida', 'rentabilidade').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Percentual das receitas que sobra como lucro. Ideal: acima de 20%. Fórmula: (Resultado Líquido / Receitas) × 100."
          icon={<TrendingUp className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Retorno sobre Ativos (ROA)"
          value={formatPercent(indicadores1.rentabilidade.roa.valor)}
          status={indicadores1.rentabilidade.roa.status}
          trend={range2.from ? getDisplayTrend('roa', 'rentabilidade').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Rentabilidade gerada sobre o total de ativos. Fórmula: (Resultado Líquido / Ativos Totais) × 100."
          icon={<Activity className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Retorno sobre PL (ROE)"
          value={formatPercent(indicadores1.rentabilidade.roe.valor)}
          status={indicadores1.rentabilidade.roe.status}
          trend={range2.from ? getDisplayTrend('roe', 'rentabilidade').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Rentabilidade gerada sobre o capital próprio. Fórmula: (Resultado Líquido / Patrimônio Líquido) × 100."
          icon={<TrendingUp className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Liberdade Financeira"
          value={formatPercent(indicadores1.rentabilidade.liberdadeFinanceira.valor)}
          status={indicadores1.rentabilidade.liberdadeFinanceira.status}
          trend={range2.from ? getDisplayTrend('liberdadeFinanceira', 'rentabilidade').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Percentual das despesas cobertas por rendimentos passivos. 100% significa independência financeira. Fórmula: (Rendimentos / Despesas Totais) × 100."
          icon={<Anchor className="w-6 h-6" />}
          size="sm"
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores de Eficiência"
        subtitle="Otimização de recursos"
        icon={<Gauge className="w-4 h-4" />}
      >
        <ReportCard
          title="Part. Despesas Fixas"
          value={formatPercent(indicadores1.eficiencia.participacaoFixas.valor)}
          status={indicadores1.eficiencia.participacaoFixas.status}
          trend={range2.from ? getDisplayTrend('participacaoFixas', 'eficiencia').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Percentual das receitas consumido por gastos fixos recorrentes. Ideal: abaixo de 40%. Fórmula: (Despesas Fixas / Receitas Totais) × 100."
          icon={<Activity className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Burn Rate (Consumo)"
          value={formatPercent(indicadores1.eficiencia.burnRate.valor)}
          status={indicadores1.eficiencia.burnRate.status}
          trend={range2.from ? getDisplayTrend('burnRate', 'eficiencia').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Velocidade com que você consome sua receita mensal. Ideal: abaixo de 70%. Fórmula: (Despesas Totais / Receitas Totais) × 100."
          icon={<Flame className="w-6 h-6" />}
          size="sm"
        />
      </IndicatorGroup>

      <IndicatorGroup
        title="Indicadores Pessoais"
        subtitle="Saúde financeira individual"
        icon={<Activity className="w-4 h-4" />}
      >
        <ReportCard
          title="Margem de Segurança"
          value={formatPercent(indicadores1.pessoais.margemSeguranca.valor)}
          status={indicadores1.pessoais.margemSeguranca.status}
          trend={range2.from ? getDisplayTrend('margemSeguranca', 'pessoais').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Percentual da receita que sobra livre após todos os gastos e parcelas. Ideal: acima de 20%."
          icon={<ShieldCheck className="w-6 h-6" />}
          size="sm"
        />
        <ReportCard
          title="Meses de Sobrevivência"
          value={formatMeses(indicadores1.pessoais.mesesSobrevivencia.valor)}
          status={indicadores1.pessoais.mesesSobrevivencia.status}
          trend={range2.from ? getDisplayTrend('mesesSobrevivencia', 'pessoais').percent : undefined}
          trendLabel={range2.from ? "período anterior" : undefined}
          tooltip="Quantos meses você consegue manter seu padrão de vida apenas com reservas. Ideal: acima de 6 meses. Fórmula: Caixa / Custo de Vida Mensal."
          icon={<Calculator className="w-6 h-6" />}
          size="sm"
        />
      </IndicatorGroup>
    </div>
  );
}