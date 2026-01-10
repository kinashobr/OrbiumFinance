"use client";

import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, Wallet, Target, CircleDollarSign, Landmark, Coins, Bitcoin, ArrowUpRight, ArrowDownRight, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges } from "@/types/finance";
import { InvestmentEvolutionChart } from "@/components/investments/InvestmentEvolutionChart";

const STABLECOIN_NAMES = ['usdt', 'usdc', 'dai', 'busd', 'tusd'];

export default function Investimentos() {
  const { 
    contasMovimento,
    getValorFipeTotal,
    calculateBalanceUpToDate,
    dateRanges,
    setDateRanges,
    calculateTotalInvestmentBalanceAtDate,
    transacoesV2,
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState("carteira");

  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const calculateAccountBalance = useCallback((accountId: string, targetDate: Date | undefined): number => {
    return calculateBalanceUpToDate(accountId, targetDate, transacoesV2, contasMovimento);
  }, [calculateBalanceUpToDate, transacoesV2, contasMovimento]);

  const investmentAccounts = useMemo(() => {
    return contasMovimento.filter(c => ['renda_fixa', 'poupanca', 'cripto', 'reserva', 'objetivo'].includes(c.accountType));
  }, [contasMovimento]);

  const calculos = useMemo(() => {
    const targetDate = dateRanges.range1.to;
    const patrimonioInvestimentos = calculateTotalInvestmentBalanceAtDate(targetDate);
    const valorVeiculos = getValorFipeTotal(targetDate);
    const patrimonioTotal = patrimonioInvestimentos + valorVeiculos;
    
    return { patrimonioTotal, patrimonioInvestimentos };
  }, [calculateTotalInvestmentBalanceAtDate, getValorFipeTotal, dateRanges.range1.to]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const AssetListItem = ({ account }: { account: any }) => {
    const saldo = calculateAccountBalance(account.id, dateRanges.range1.to);
    const Icon = account.accountType === 'cripto' ? Bitcoin : (account.accountType === 'poupanca' ? Coins : Landmark);
    
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors group">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-tight">{account.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{account.institution || account.accountType}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-black text-sm text-foreground leading-tight">{formatCurrency(saldo)}</p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-success font-bold">
            <ArrowUpRight className="w-3 h-3" /> 0.8%
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-3 animate-fade-in border-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="inline-flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Gestão de Ativos</span>
                <span className="text-[11px]">Performance de Carteira</span>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patrimônio Total Card - Estilo conta */}
          <div className="glass-card p-6 rounded-[1.75rem] border-l-4 border-l-primary flex flex-col justify-between h-40">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <CircleDollarSign className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-none text-[10px] font-bold">+2.4%</Badge>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Patrimônio Líquido</p>
              <p className="text-2xl font-black text-foreground">{formatCurrency(calculos.patrimonioTotal)}</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-[1.75rem] border-l-4 border-l-success flex flex-col justify-between h-40">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <Landmark className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-none text-[10px] font-bold">+1.2k</Badge>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total em Investimentos</p>
              <p className="text-2xl font-black text-foreground">{formatCurrency(calculos.patrimonioInvestimentos)}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="border-b border-border/40">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger value="carteira" className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-3 text-xs font-bold uppercase">Visão Geral</TabsTrigger>
              <TabsTrigger value="ativos" className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-3 text-xs font-bold uppercase">Meus Ativos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="carteira" className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-5 rounded-[1.75rem]">
                <h4 className="text-sm font-bold text-foreground mb-4">Evolução Histórica</h4>
                <InvestmentEvolutionChart />
              </div>
              <div className="glass-card p-5 rounded-[1.75rem] flex flex-col items-center justify-center">
                <h4 className="text-sm font-bold text-foreground mb-4 w-full">Distribuição</h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={[
                          { name: 'RF', value: 70 },
                          { name: 'Cripto', value: 20 },
                          { name: 'Liquidez', value: 10 }
                        ]} 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--success))" />
                        <Cell fill="hsl(var(--warning))" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                   <Badge className="bg-primary/10 text-primary border-none text-[9px]">Renda Fixa</Badge>
                   <Badge className="bg-success/10 text-success border-none text-[9px]">Cripto</Badge>
                   <Badge className="bg-warning/10 text-warning border-none text-[9px]">Outros</Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ativos" className="animate-fade-in-up">
            <div className="glass-card p-5 rounded-[1.75rem] space-y-3">
              <h4 className="text-sm font-bold text-foreground mb-4">Portfólio Detalhado</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {investmentAccounts.map(account => (
                  <AssetListItem key={account.id} account={account} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}