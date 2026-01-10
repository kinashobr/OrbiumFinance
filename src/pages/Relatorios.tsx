"use client";

import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalancoTab } from "@/components/reports/BalancoTab";
import { DRETab } from "@/components/reports/DRETab";
import { IndicadoresTab } from "@/components/reports/IndicadoresTab";
import { Scale, Receipt, Activity, BarChart3, Sparkles } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";

export default function Relatorios() {
  const { dateRanges, setDateRanges } = useFinance();

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  return (
    <MainLayout>
      <div className="space-y-10 pb-12">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-xl shadow-primary/20 ring-4 ring-primary/10">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-bold text-3xl leading-none tracking-tight text-foreground">Análise</h1>
              <div className="flex items-center gap-2 mt-1">
                 <Sparkles className="w-3.5 h-3.5 text-accent" />
                 <p className="text-xs text-muted-foreground font-black tracking-widest uppercase opacity-60">Inteligência Patrimonial</p>
              </div>
            </div>
          </div>
          <PeriodSelector 
            initialRanges={dateRanges}
            onDateRangeChange={handlePeriodChange}
            className="h-11 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm px-6 font-bold"
          />
        </header>

        <Tabs defaultValue="balanco" className="space-y-8">
          <div className="border-b border-border/40 px-1">
            <TabsList className="bg-transparent h-auto p-0 gap-10">
              <TabsTrigger
                value="balanco"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                <Scale className="w-4 h-4 mr-2.5" />
                Balanço
              </TabsTrigger>
              <TabsTrigger
                value="dre"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                <Receipt className="w-4 h-4 mr-2.5" />
                DRE
              </TabsTrigger>
              <TabsTrigger
                value="indicadores"
                className="bg-transparent rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                <Activity className="w-4 h-4 mr-2.5" />
                Saúde
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="balanco" className="mt-0 focus-visible:outline-none">
            <BalancoTab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="dre" className="mt-0 focus-visible:outline-none">
            <DRETab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="indicadores" className="mt-0 focus-visible:outline-none">
            <IndicadoresTab dateRanges={dateRanges} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}