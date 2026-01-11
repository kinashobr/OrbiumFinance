"use client";

import { useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalancoTab } from "@/components/reports/BalancoTab";
import { DRETab } from "@/components/reports/DRETab";
import { IndicadoresTab } from "@/components/reports/IndicadoresTab";
import { Scale, Receipt, Activity, BarChart3, Sparkles, LineChart, Info, TrendingUp } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges, formatCurrency } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Relatorios() {
  const { dateRanges, setDateRanges, getPatrimonioLiquido } = useFinance();

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const plAtual = useMemo(() => getPatrimonioLiquido(dateRanges.range1.to), [getPatrimonioLiquido, dateRanges.range1.to]);
  const plAnterior = useMemo(() => getPatrimonioLiquido(dateRanges.range2.to), [getPatrimonioLiquido, dateRanges.range2.to]);
  const variacaoPl = plAnterior !== 0 ? ((plAtual - plAnterior) / Math.abs(plAnterior)) * 100 : 0;

  return (
    <MainLayout>
      <div className="space-y-10 pb-12">
        {/* HEADER EXPRESSIVO */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-xl shadow-primary/20 ring-4 ring-primary/10">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-bold text-3xl leading-none tracking-tight">Inteligência</h1>
              <p className="text-sm text-muted-foreground font-bold tracking-widest mt-1 uppercase opacity-60">Análise e Performance</p>
            </div>
          </div>
          <PeriodSelector 
            initialRanges={dateRanges}
            onDateRangeChange={handlePeriodChange}
            className="h-11 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm px-6 font-bold"
          />
        </header>

        {/* HERO CARD: PERFORMANCE PATRIMONIAL */}
        <div className="animate-fade-in-up">
           <div className="bg-surface-light dark:bg-surface-dark rounded-[40px] p-10 shadow-soft relative overflow-hidden border border-white/60 dark:border-white/5 h-[320px] flex flex-col justify-center group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-50"></div>
              
              {/* Abstract decorative element */}
              <div className="absolute right-0 top-0 opacity-10 scale-150 translate-x-10 -translate-y-10 group-hover:rotate-12 transition-transform duration-1000">
                <LineChart className="w-[300px] h-[300px] text-primary" />
              </div>

              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-widest">
                    Consolidado Patrimonial
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orbium Insights</span>
                  </div>
                </div>
                
                <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Patrimônio Líquido Final</h2>
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
                   <h3 className="font-display font-extrabold text-6xl sm:text-7xl text-foreground tracking-tighter leading-none tabular-nums">
                     {formatCurrency(plAtual)}
                   </h3>
                   <div className="pb-2">
                     <Badge className={cn(
                        "rounded-xl px-4 py-2 font-black text-sm gap-2",
                        variacaoPl >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                     )}>
                        {variacaoPl >= 0 ? <TrendingUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        {variacaoPl >= 0 ? '+' : ''}{variacaoPl.toFixed(1)}% evolução
                     </Badge>
                   </div>
                </div>
                
                <p className="text-sm text-muted-foreground font-medium mt-6 max-w-md">
                   Sua riqueza líquida é composta por todos os seus ativos financeiros e bens imobilizados, subtraindo todas as suas obrigações atuais.
                </p>
              </div>
           </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS */}
        <Tabs defaultValue="balanco" className="space-y-10">
          <div className="border-b border-border/40 px-2">
            <TabsList className="bg-transparent h-auto p-0 gap-10">
              <TabsTrigger
                value="balanco"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground data-[state=active]:text-foreground transition-all group"
              >
                <Scale className="w-4 h-4 mr-2.5 group-data-[state=active]:text-primary" />
                Balanço
              </TabsTrigger>
              <TabsTrigger
                value="dre"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground data-[state=active]:text-foreground transition-all group"
              >
                <Receipt className="w-4 h-4 mr-2.5 group-data-[state=active]:text-primary" />
                DRE
              </TabsTrigger>
              <TabsTrigger
                value="indicadores"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground data-[state=active]:text-foreground transition-all group"
              >
                <Activity className="w-4 h-4 mr-2.5 group-data-[state=active]:text-primary" />
                Saúde
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="balanco" className="mt-0 outline-none">
            <BalancoTab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="dre" className="mt-0 outline-none">
            <DRETab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="indicadores" className="mt-0 outline-none">
            <IndicadoresTab dateRanges={dateRanges} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}