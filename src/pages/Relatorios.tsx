import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalancoTab } from "@/components/reports/BalancoTab";
import { DRETab } from "@/components/reports/DRETab";
import { IndicadoresTab } from "@/components/reports/IndicadoresTab";
import { Scale, Receipt, Activity, BarChart3 } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";

const Relatorios = () => {
  const { dateRanges, setDateRanges } = useFinance();

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-3 animate-fade-in border-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="inline-flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Relatórios Gerenciais</span>
                <span className="text-[11px]">Balanço e Demonstrações</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 max-w-full">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="h-8 rounded-full border-none bg-card px-3 text-[11px] font-medium text-secondary shadow-xs"
            />
          </div>
        </header>

        <Tabs defaultValue="balanco" className="space-y-6">
          <div className="border-b border-border/40 px-1">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
              <TabsTrigger
                value="balanco"
                className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
              >
                <Scale className="w-3.5 h-3.5 mr-2" />
                Balanço
              </TabsTrigger>
              <TabsTrigger
                value="dre"
                className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
              >
                <Receipt className="w-3.5 h-3.5 mr-2" />
                DRE
              </TabsTrigger>
              <TabsTrigger
                value="indicadores"
                className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
              >
                <Activity className="w-3.5 h-3.5 mr-2" />
                Indicadores
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="balanco" className="mt-0 animate-fade-in-up">
            <BalancoTab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="dre" className="mt-0 animate-fade-in-up">
            <DRETab dateRanges={dateRanges} />
          </TabsContent>
          <TabsContent value="indicadores" className="mt-0 animate-fade-in-up">
            <IndicadoresTab dateRanges={dateRanges} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Relatorios;