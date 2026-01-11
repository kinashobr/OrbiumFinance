"use client";

import { useMemo, useState } from "react";
import { 
  Activity, ShieldCheck, Zap, Scale, Sparkles, TrendingUp, 
  TrendingDown, Target, Shield, Gauge, Heart, Wallet, 
  Coins, Landmark, BarChart3, Plus, LayoutGrid, User, Minus, Calendar // Adicionado Minus e Calendar
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { ComparisonDateRanges, DateRange, formatCurrency } from "@/types/finance";
import { startOfDay, endOfDay, isWithinInterval, subMonths } from "date-fns";
import { parseDateLocal, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { IndicatorCard, IndicatorStatus } from "./IndicatorCard";
import { CustomIndicatorModal } from "./CustomIndicatorModal";
import { Button } from "@/components/ui/button";

export function IndicadoresTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { 
    transacoesV2, 
    getAtivosTotal, 
    getPassivosTotal, 
    contasMovimento, 
    calculateBalanceUpToDate,
    getValorFipeTotal,
    getSegurosAApropriar,
    getSegurosAPagar,
    getLoanPrincipalRemaining,
    getCreditCardDebt,
    categoriasV2
  } = useFinance();
  
  const [showCustomModal, setShowCustomModal] = useState(false);
  const { range1, range2 } = dateRanges;

  const calculateMetrics = useCallback((range: DateRange) => {
    const date = range.to || new Date();
    const from = range.from ? startOfDay(range.from) : new Date(0);
    const to = range.to ? endOfDay(range.to) : new Date();

    const txs = transacoesV2.filter(t => {
      try {
        const d = parseDateLocal(t.date);
        return isWithinInterval(d, { start: from, end: to });
      } catch { return false; }
    });

    // --- Dados Base ---
    const totalAtivos = getAtivosTotal(date);
    const totalPassivos = getPassivosTotal(date);
    const pl = totalAtivos - totalPassivos;
    
    const ativoCirculante = contasMovimento
      .filter(c => ['corrente', 'poupanca', 'reserva'].includes(c.accountType))
      .reduce((acc, c) => acc + Math.max(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)), 0);
    
    const disponibilidades = contasMovimento
      .filter(c => c.accountType === 'corrente')
      .reduce((acc, c) => acc + Math.max(0, calculateBalanceUpToDate(c.id, date, transacoesV2, contasMovimento)), 0);

    const passivoCirculante = getCreditCardDebt(date) + getSegurosAPagar(date); // Simplificado para o exemplo

    const receitas = txs.filter(t => t.operationType === 'receita' || t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0);
    const despesas = txs.filter(t => t.flow === 'out').reduce((a, t) => a + t.amount, 0);
    const lucro = receitas - despesas;
    
    const fixas = txs.filter(t => {
        const cat = categoriasV2.find(c => c.id === t.categoryId);
        return cat?.nature === 'despesa_fixa';
    }).reduce((a, t) => a + t.amount, 0);

    const imobilizado = getValorFipeTotal(date);

    // --- Indicadores ---
    return {
      poupanca: receitas > 0 ? (lucro / receitas) * 100 : 0,
      liqCorrente: passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0,
      liqSeca: passivoCirculante > 0 ? (ativoCirculante - 0) / passivoCirculante : 0, // Sem estoque em finanças pessoais
      solvenciaImediata: passivoCirculante > 0 ? disponibilidades / passivoCirculante : 0,
      liqGeral: totalPassivos > 0 ? totalAtivos / totalPassivos : 0,
      
      endivTotal: totalAtivos > 0 ? (totalPassivos / totalAtivos) * 100 : 0,
      dividaPatrimonio: pl > 0 ? (totalPassivos / pl) * 100 : 0,
      imobPL: pl > 0 ? (imobilizado / pl) * 100 : 0,
      compDivida: totalPassivos > 0 ? (passivoCirculante / totalPassivos) * 100 : 0,
      
      margemLiquida: receitas > 0 ? (lucro / receitas) * 100 : 0,
      roa: totalAtivos > 0 ? (lucro / totalAtivos) * 100 : 0,
      roe: pl > 0 ? (lucro / pl) * 100 : 0,
      liberdade: lucro > 0 ? (txs.filter(t => t.operationType === 'rendimento').reduce((a, t) => a + t.amount, 0) / despesas) * 100 : 0,
      
      partFixas: despesas > 0 ? (fixas / despesas) * 100 : 0,
      burnRate: receitas > 0 ? (despesas / receitas) * 100 : 0,
      
      margemSeguranca: receitas > 0 ? ((receitas - fixas) / receitas) * 100 : 0,
      sobrevivencia: fixas > 0 ? ativoCirculante / fixas : 0,
    };
  }, [transacoesV2, getAtivosTotal, getPassivosTotal, contasMovimento, calculateBalanceUpToDate, getCreditCardDebt, getSegurosAPagar, getValorFipeTotal, categoriasV2]);

  const m1 = useMemo(() => calculateMetrics(range1), [calculateMetrics, range1]);
  const m2 = useMemo(() => calculateMetrics(range2), [calculateMetrics, range2]);

  const getTrend = (v1: number, v2: number) => v2 !== 0 ? ((v1 - v2) / Math.abs(v2)) * 100 : 0;

  const SectionHeader = ({ title, subtitle, icon: Icon }: any) => (
    <div className="flex items-center justify-between mb-6 px-2">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
          <Icon size={24} />
        </div>
        <div>
          <h3 className="font-display font-black text-xl text-foreground uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-16 animate-fade-in-up pb-20">
      {/* Legenda e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-muted/30 p-6 rounded-[2.5rem] border border-border/40">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saudável</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Atenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Crítico</span>
          </div>
        </div>
        <Button 
          onClick={() => setShowCustomModal(true)}
          className="rounded-full h-11 px-8 font-black text-xs gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={16} /> NOVO INDICADOR
        </Button>
      </div>

      {/* 1. MEUS INDICADORES (Destaque) */}
      <section>
        <SectionHeader title="Meus Indicadores" subtitle="Métricas criadas por você" icon={User} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard 
            title="Capacidade Poupança" 
            value={`${m1.poupanca.toFixed(1)}%`} 
            trend={getTrend(m1.poupanca, m2.poupanca)}
            status={m1.poupanca >= 20 ? "success" : m1.poupanca >= 10 ? "warning" : "danger"}
            icon={ShieldCheck}
          />
        </div>
      </section>

      {/* 2. LIQUIDEZ */}
      <section>
        <SectionHeader title="Indicadores de Liquidez" subtitle="Capacidade de pagamento de curto prazo" icon={Wallet} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="Liquidez Corrente" value={`${m1.liqCorrente.toFixed(2)}x`} trend={getTrend(m1.liqCorrente, m2.liqCorrente)} status={m1.liqCorrente >= 1.5 ? "success" : "warning"} icon={TrendingUp} />
          <IndicatorCard title="Liquidez Seca" value={`${m1.liqSeca.toFixed(2)}x`} trend={getTrend(m1.liqSeca, m2.liqSeca)} status={m1.liqSeca >= 1.2 ? "success" : "warning"} icon={Zap} />
          <IndicatorCard title="Solvência Imediata" value={`${m1.solvenciaImediata.toFixed(2)}x`} trend={getTrend(m1.solvenciaImediata, m2.solvenciaImediata)} status={m1.solvenciaImediata >= 1 ? "success" : "warning"} icon={Activity} />
          <IndicatorCard title="Liquidez Geral" value={`${m1.liqGeral.toFixed(2)}x`} trend={getTrend(m1.liqGeral, m2.liqGeral)} status={m1.liqGeral >= 2 ? "success" : "warning"} icon={Shield} />
        </div>
      </section>

      {/* 3. ENDIVIDAMENTO */}
      <section>
        <SectionHeader title="Indicadores de Endividamento" subtitle="Nível de comprometimento com dívidas" icon={Scale} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="Endividamento Total" value={`${m1.endivTotal.toFixed(1)}%`} trend={getTrend(m1.endivTotal, m2.endivTotal)} status={m1.endivTotal <= 30 ? "success" : "warning"} icon={TrendingDown} />
          <IndicatorCard title="Dívida / Patrimônio" value={`${m1.dividaPatrimonio.toFixed(1)}%`} trend={getTrend(m1.dividaPatrimonio, m2.dividaPatrimonio)} status={m1.dividaPatrimonio <= 50 ? "success" : "warning"} icon={Target} />
          <IndicatorCard title="Imobilização do PL" value={`${m1.imobPL.toFixed(1)}%`} trend={getTrend(m1.imobPL, m2.imobPL)} status={m1.imobPL <= 60 ? "success" : "warning"} icon={Landmark} />
          <IndicatorCard title="Composição da Dívida" value={`${m1.compDivida.toFixed(1)}%`} trend={getTrend(m1.compDivida, m2.compDivida)} status={m1.compDivida <= 40 ? "success" : "warning"} icon={LayoutGrid} />
        </div>
      </section>

      {/* 4. RENTABILIDADE */}
      <section>
        <SectionHeader title="Indicadores de Rentabilidade" subtitle="Retorno sobre recursos" icon={TrendingUp} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="Margem Líquida" value={`${m1.margemLiquida.toFixed(1)}%`} trend={getTrend(m1.margemLiquida, m2.margemLiquida)} status={m1.margemLiquida >= 15 ? "success" : "warning"} icon={Sparkles} />
          <IndicatorCard title="Retorno sobre Ativos (ROA)" value={`${m1.roa.toFixed(1)}%`} trend={getTrend(m1.roa, m2.roa)} status={m1.roa >= 5 ? "success" : "warning"} icon={BarChart3} />
          <IndicatorCard title="Retorno sobre PL (ROE)" value={`${m1.roe.toFixed(1)}%`} trend={getTrend(m1.roe, m2.roe)} status={m1.roe >= 10 ? "success" : "warning"} icon={Coins} />
          <IndicatorCard title="Liberdade Financeira" value={`${m1.liberdade.toFixed(1)}%`} trend={getTrend(m1.liberdade, m2.liberdade)} status={m1.liberdade >= 100 ? "success" : "warning"} icon={Heart} />
        </div>
      </section>

      {/* 5. EFICIÊNCIA */}
      <section>
        <SectionHeader title="Indicadores de Eficiência" subtitle="Otimização de recursos" icon={Gauge} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="Part. Despesas Fixas" value={`${m1.partFixas.toFixed(1)}%`} trend={getTrend(m1.partFixas, m2.partFixas)} status={m1.partFixas <= 40 ? "success" : "warning"} icon={Minus} />
          <IndicatorCard title="Burn Rate (Consumo)" value={`${m1.burnRate.toFixed(1)}%`} trend={getTrend(m1.burnRate, m2.burnRate)} status={m1.burnRate <= 80 ? "success" : "warning"} icon={Zap} />
        </div>
      </section>

      {/* 6. PESSOAIS */}
      <section>
        <SectionHeader title="Indicadores Pessoais" subtitle="Saúde financeira individual" icon={Heart} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="Margem de Segurança" value={`${m1.margemSeguranca.toFixed(1)}%`} trend={getTrend(m1.margemSeguranca, m2.margemSeguranca)} status={m1.margemSeguranca >= 30 ? "success" : "warning"} icon={ShieldCheck} />
          <IndicatorCard title="Meses de Sobrevivência" value={`${m1.sobrevivencia.toFixed(1)} meses`} trend={getTrend(m1.sobrevivencia, m2.sobrevivencia)} status={m1.sobrevivencia >= 6 ? "success" : "warning"} icon={Calendar} />
        </div>
      </section>

      <CustomIndicatorModal 
        open={showCustomModal} 
        onOpenChange={setShowCustomModal} 
        onSave={(data) => console.log("Novo indicador:", data)} 
      />
    </div>
  );
}