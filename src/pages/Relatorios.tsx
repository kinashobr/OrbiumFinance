"use client";

import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BalancoTab } from "@/components/reports/BalancoTab";
import { DRETab } from "@/components/reports/DRETab";
import { IndicadoresTab } from "@/components/reports/IndicadoresTab";
import { Scale, Receipt, Activity, BarChart3, Sparkles, ChevronDown } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Relatorios() {
  const { dateRanges, setDateRanges } = useFinance();
  const [activeTab, setActiveTab] = useState("balanco");

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const tabOptions = [
    { value: "balanco", label: "Balanço Patrimonial", icon: Scale },
    { value: "dre", label: "DRE (Resultado)", icon: Receipt },
    { value: "indicadores", label: "Saúde e Indicadores", icon: Activity },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 pb-12">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-xl shadow-primary/20 ring-4 ring-primary/10">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-bold text-3xl leading-none tracking-tight text-foreground">Relatórios</h1>
              <div className="flex items-center gap-2 mt-1">
                 <Sparkles className="w-3.5 h-3.5 text-accent" />
                 <p className="text-xs text-muted-foreground font-black tracking-widest uppercase opacity-60">Inteligência Financeira</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Menu Suspenso para Troca de Relatório */}
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="h-11 w-full sm:w-[240px] rounded-full bg-card border-border/40 shadow-sm px-6 font-bold text-xs uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <SelectValue placeholder="Selecionar Relatório" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                {tabOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="py-3 font-bold text-xs uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <opt.icon className="w-4 h-4 text-primary" />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="h-11 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm px-6 font-bold"
            />
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
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