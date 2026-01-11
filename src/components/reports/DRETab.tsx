"use client";

import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, Calculator, Minus, Plus, Sparkles, ArrowDownRight, ArrowUpRight, Receipt, Zap, PieChart, BarChart3 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { cn, parseDateLocal } from "@/lib/utils";
import { ComparisonDateRanges, DateRange, formatCurrency } from "@/types/finance";
import { startOfDay, endOfDay, isWithinInterval, subMonths, endOfMonth, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DREStatement } from "./DREStatement";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Cell, Legend } from "recharts";
import { useChartColors } from "@/hooks/useChartColors";
import { ptBR } from "date-fns/locale";

interface DREData {
  rec: number;
  fix: number;
  var: number;
  juros: number;
  rendimentos: number;
  res: number;
  details: {
    receitas: { label: string; value: number; id: string }[];
    despesasFixas: { label: string; value: number; id: string }[];
    despesasVariaveis: { label: string; value: number; id: string }[];
  };
}

export function DRETab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { transacoesV2, categoriasV2, calculateLoanSchedule, emprestimos } = useFinance();
  const { range1, range2 } = dateRanges;
  const colors = useChartColors();
  const categoriesMap = useMemo(() => new Map(categoriasV2.map(c => [c.id, c])), [categoriasV2]);

  const calculateDRE = useCallback((range: DateRange): DREData => {
    const rangeFrom = range.from ? startOfDay(range.from) : undefined;
    const rangeTo = range.to ? endOfDay(range.to) : undefined;
    
    const txs = transacoesV2.filter(t => {
      try {
        const d = parseDateLocal(t.date);
        return (!rangeFrom || isWithinInterval(d, { start: rangeFrom, end: rangeTo || new Date() }));
      } catch { return false; }
    });

    const rec = txs.filter(t => t.operationType === 'receita').reduce((a, t) => a + t.amount, 0);
    const rendimentos = txs.filter(t => t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0);
    const receitaBruta = rec + rendimentos;
    
    const fix = txs.filter(t => categoriesMap.get(t.categoryId || '')?.nature === 'despesa_fixa').reduce((a, t) => a + t.amount, 0);
    const var_ = txs.filter(t => categoriesMap.get(t.categoryId || '')?.nature === 'despesa_variavel').reduce((a, t) => a + t.amount, 0);
    
    let juros = 0;
    txs.filter(t => t.operationType === 'pagamento_emprestimo').forEach(t => {
      const lid = t.links?.loanId?.replace('loan_', '');
      const pid = t.links?.parcelaId;
      if (lid && pid) {
        const s = calculateLoanSchedule(parseInt(lid));
        const item = s.find(i => i.parcela === parseInt(pid));
        if (item) juros += item.juros;
      }
    });
    
    const resultadoFinanceiro = rendimentos - juros;
    const resultadoOperacional = receitaBruta - fix - var_;
    const resultadoLiquido = resultadoOperacional + resultadoFinanceiro;
    
    // Detalhes por categoria
    const groupDetails = (nature: 'receita' | 'despesa_fixa' | 'despesa_variavel') => {
      const filteredTxs = txs.filter(t => categoriesMap.get(t.categoryId || '')?.nature === nature);
      const grouped = filteredTxs.reduce((acc, t) => {
        const label = categoriesMap.get(t.categoryId || '')?.label || 'Outros';
        acc[label] = (acc[label] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      return Object.entries(grouped).map(([label, value]) => ({ label, value, id: label }));
    };

    return { 
      rec: receitaBruta, 
      fix, 
      var: var_, 
      juros, 
      rendimentos,
      res: resultadoLiquido,
      details: {
        receitas: groupDetails('receita'),
        despesasFixas: groupDetails('despesa_fixa'),
        despesasVariaveis: groupDetails('despesa_variavel'),
      }
    };
  }, [transacoesV2, categoriasV2, calculateLoanSchedule, categoriesMap]);

  const dre1 = useMemo(() => calculateDRE(range1), [calculateDRE, range1]);
  const dre2 = useMemo(() => calculateDRE(range2), [calculateDRE, range2]);

  const variacaoRL = dre2.res !== 0 ? ((dre1.res - dre2.res) / Math.abs(dre2.res)) * 100 : 0;
  const totalDespesas = dre1.fix + dre1.var + dre1.juros;
  
  const formatCurrencyFn = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  // Estrutura de dados para o DREStatement
  const dreStatementData = useMemo(() => {
    const data: any[] = [];
    
    // 1. RECEITA BRUTA
    data.push({ label: 'RECEITA BRUTA', value: dre1.rec, type: 'header', icon: Plus, color: colors.success });
    data.push(...dre1.details.receitas.map(d => ({ label: d.label, value: d.value, type: 'detail', color: colors.success })));
    
    // 2. (-) DESPESAS FIXAS
    data.push({ label: '(-) DESPESAS FIXAS', value: -dre1.fix, type: 'header', icon: TrendingDown, color: colors.destructive });
    data.push(...dre1.details.despesasFixas.map(d => ({ label: d.label, value: -d.value, type: 'detail', color: colors.destructive })));
    
    // 3. RESULTADO BRUTO (Receita - Fixas)
    const resultadoBruto = dre1.rec - dre1.fix;
    data.push({ label: 'RESULTADO BRUTO', value: resultadoBruto, type: 'subtotal', icon: Zap, color: resultadoBruto >= 0 ? colors.success : colors.destructive });
    
    // 4. (-) DESPESAS VARIÁVEIS
    data.push({ label: '(-) DESPESAS VARIÁVEIS', value: -dre1.var, type: 'header', icon: TrendingDown, color: colors.destructive });
    data.push(...dre1.details.despesasVariaveis.map(d => ({ label: d.label, value: -d.value, type: 'detail', color: colors.destructive })));
    
    // 5. RESULTADO OPERACIONAL (Resultado Bruto - Variáveis)
    const resultadoOperacional = resultadoBruto - dre1.var;
    data.push({ label: 'RESULTADO OPERACIONAL', value: resultadoOperacional, type: 'subtotal', icon: Calculator, color: resultadoOperacional >= 0 ? colors.success : colors.destructive });
    
    // 6. (+/-) RESULTADO FINANCEIRO
    data.push({ label: '(+/-) RESULTADO FINANCEIRO', value: dre1.rendimentos - dre1.juros, type: 'header', icon: DollarSign, color: (dre1.rendimentos - dre1.juros) >= 0 ? colors.success : colors.destructive });
    if (dre1.rendimentos > 0) data.push({ label: '(+) Rendimentos de Investimentos', value: dre1.rendimentos, type: 'detail', color: colors.success });
    if (dre1.juros > 0) data.push({ label: '(-) Juros de Empréstimos', value: -dre1.juros, type: 'detail', color: colors.destructive });
    
    // 7. RESULTADO LÍQUIDO
    data.push({ label: 'RESULTADO LÍQUIDO', value: dre1.res, type: 'final', icon: Receipt, color: colors.primary });
    
    return data;
  }, [dre1, colors]);
  
  // Dados para o gráfico de Evolução do Resultado
  const evolutionData = useMemo(() => {
    const now = new Date();
    const result: { mes: string; receitas: number; despesas: number; resultado: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const data = subMonths(now, i);
      const range = { from: startOfMonth(data), to: endOfMonth(data) };
      const dre = calculateDRE(range);
      const mesLabel = format(data, 'MMM', { locale: ptBR });
      
      result.push({ 
        mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1), 
        receitas: dre.rec, 
        despesas: dre.fix + dre.var + dre.juros, 
        resultado: dre.res,
      });
    }
    return result;
  }, [calculateDRE]);
  
  // Dados para o gráfico de Composição das Despesas
  const compositionData = useMemo(() => {
    const total = dre1.fix + dre1.var + dre1.juros;
    if (total === 0) return [];
    return [
      { name: 'Despesas Fixas', value: dre1.fix, color: colors.primary },
      { name: 'Despesas Variáveis', value: dre1.var, color: colors.destructive },
      { name: 'Juros Financeiros', value: dre1.juros, color: colors.warning },
    ].filter(d => d.value > 0);
  }, [dre1, colors]);

  return (
    <div className="space-y-12 animate-fade-in">
      {/* HEADER PRINCIPAL (RESULTADO LÍQUIDO) */}
      <div className={cn(
        "rounded-[40px] p-10 shadow-soft border-4 transition-all duration-700 relative overflow-hidden flex flex-col justify-center h-[320px] group",
        dre1.res >= 0 ? "bg-success/5 border-success/20 shadow-success/10" : "bg-destructive/5 border-destructive/20 shadow-destructive/10"
      )}>
        <div className="absolute right-0 top-0 opacity-10 scale-150 translate-x-12 -translate-y-12 group-hover:rotate-12 transition-transform duration-1000"><Receipt className="w-[300px] h-[300px]" /></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
             <div className={cn("p-3 rounded-2xl shadow-xl", dre1.res >= 0 ? "bg-success text-white" : "bg-destructive text-white")}><Zap className="w-8 h-8" /></div>
             <div><p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60">Demonstrativo de Resultado</p><h3 className="font-display font-black text-2xl uppercase">{dre1.res >= 0 ? "Resultado Líquido Positivo" : "Prejuízo Líquido"}</h3></div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-10">
             <h2 className={cn("text-7xl sm:text-8xl font-black tracking-tighter tabular-nums leading-none", dre1.res >= 0 ? "text-success" : "text-destructive")}>{formatCurrencyFn(dre1.res)}</h2>
             <Badge className={cn("rounded-xl px-5 py-2 font-black text-sm mb-2 w-fit", variacaoRL >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                {variacaoRL >= 0 ? <ArrowUpRight className="w-4 h-4 mr-2" /> : <ArrowDownRight className="w-4 h-4 mr-2" />}
                {Math.abs(variacaoRL).toFixed(1)}% vs anterior
             </Badge>
          </div>
        </div>
      </div>

      {/* GRID DE KPIS DE FLUXO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="p-5 rounded-[2rem] bg-success/5 border border-success/20 shadow-sm">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Receita Bruta</p>
            <p className="text-lg font-black tabular-nums text-success">{formatCurrencyFn(dre1.rec)}</p>
         </div>
         <div className="p-5 rounded-[2rem] bg-destructive/5 border border-destructive/20 shadow-sm">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Despesa Operacional</p>
            <p className="text-lg font-black tabular-nums text-destructive">{formatCurrencyFn(dre1.fix + dre1.var)}</p>
         </div>
         <div className="p-5 rounded-[2rem] bg-primary/5 border border-primary/20 shadow-sm">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Resultado Financeiro</p>
            <p className={cn("text-lg font-black tabular-nums", (dre1.rendimentos - dre1.juros) >= 0 ? "text-success" : "text-destructive")}>{formatCurrencyFn(dre1.rendimentos - dre1.juros)}</p>
         </div>
         <div className="p-5 rounded-[2rem] bg-muted/50 border border-border/40 shadow-sm">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Margem Líquida</p>
            <p className={cn("text-lg font-black tabular-nums", (dre1.res / dre1.rec) * 100 >= 20 ? "text-success" : "text-warning")}>
                {dre1.rec > 0 ? ((dre1.res / dre1.rec) * 100).toFixed(1) : 0}%
            </p>
         </div>
      </div>

      {/* DETALHAMENTO DRE (LISTA) */}
      <DREStatement data={dreStatementData} title="Estrutura Contábil" />

      {/* GRÁFICOS DE ANÁLISE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Evolução do Resultado (2/3) */}
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 shadow-soft">
            <div className="flex items-center gap-3 mb-8 px-2">
               <div className="p-2 bg-primary/10 rounded-xl text-primary"><BarChart3 className="w-5 h-5" /></div>
               <h4 className="font-display font-black text-xl text-foreground uppercase tracking-tight">Evolução do Resultado</h4>
            </div>
            <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData}>
                     <defs>
                        <linearGradient id="recGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colors.success} stopOpacity={0.3}/><stop offset="95%" stopColor={colors.success} stopOpacity={0}/></linearGradient>
                        <linearGradient id="despGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colors.destructive} stopOpacity={0.3}/><stop offset="95%" stopColor={colors.destructive} stopOpacity={0}/></linearGradient>
                        <linearGradient id="resGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/><stop offset="95%" stopColor={colors.primary} stopOpacity={0}/></linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                     <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 'bold'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                     <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} formatter={(v: number, name: string) => [formatCurrencyFn(v), name]} />
                     <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                     <Area type="monotone" dataKey="receitas" name="Receitas" stroke={colors.success} strokeWidth={2} fillOpacity={1} fill="url(#recGradient)" />
                     <Area type="monotone" dataKey="despesas" name="Despesas" stroke={colors.destructive} strokeWidth={2} fillOpacity={1} fill="url(#despGradient)" />
                     <Area type="monotone" dataKey="resultado" name="Resultado" stroke={colors.primary} strokeWidth={3} fillOpacity={1} fill="url(#resGradient)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
        </div>

        {/* Composição das Despesas (1/3) */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 shadow-soft flex flex-col">
            <div className="flex items-center gap-3 mb-8 px-2">
               <div className="p-2 bg-accent/10 rounded-xl text-accent"><PieChart className="w-5 h-5" /></div>
               <h4 className="font-display font-black text-xl text-foreground uppercase tracking-tight">Composição Despesas</h4>
            </div>
            <div className="flex-1 min-h-[240px]">
               <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                     <Pie data={compositionData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                        {compositionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Pie>
                     <Tooltip formatter={(v: number, name: string) => [formatCurrencyFn(v), name]} />
                  </RePieChart>
               </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
               {compositionData.map((d, i) => (
                  <div key={d.name} className="text-center">
                     <p className="text-[9px] font-black text-muted-foreground uppercase">{d.name.split(' ')[0]}</p>
                     <div className="h-1 rounded-full mt-1" style={{ backgroundColor: d.color }} />
                  </div>
               ))}
            </div>
        </div>
      </div>
    </div>
  );
}