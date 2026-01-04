import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, DollarSign, Wallet, Target, RefreshCw, Calculator } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatCurrency } from "@/types/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, subDays, startOfMonth } from "date-fns";

interface BillsSidebarKPIsProps {
  currentDate: Date;
  totalPendingBills: number;
  totalPaidBills?: number;
}

const formatToBR = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseFromBR = (value: string): number => {
    const cleaned = value.replace(/[^\d,]/g, '');
    const parsed = parseFloat(cleaned.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
};

export function BillsSidebarKPIs({ currentDate, totalPendingBills, totalPaidBills = 0 }: BillsSidebarKPIsProps) {
  const { 
    monthlyRevenueForecast, 
    setMonthlyRevenueForecast, 
    getRevenueForPreviousMonth,
    calculateBalanceUpToDate,
    contasMovimento,
    transacoesV2,
  } = useFinance();
  
  const [forecastInput, setForecastInput] = useState(() => formatToBR(monthlyRevenueForecast));
  
  useEffect(() => {
      setForecastInput(formatToBR(monthlyRevenueForecast));
  }, [monthlyRevenueForecast]);

  const highLiquidityAccountIds = useMemo(() => 
    contasMovimento
      .filter(c => ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType))
      .map(c => c.id)
  , [contasMovimento]);

  const calculos = useMemo(() => {
    const startOfCurrentMonth = startOfMonth(currentDate);
    const dayBeforeStart = subDays(startOfCurrentMonth, 1);
    
    const initialBalance = highLiquidityAccountIds.reduce((acc, accountId) => {
      const balance = calculateBalanceUpToDate(accountId, dayBeforeStart, transacoesV2, contasMovimento);
      return acc + balance;
    }, 0);
    
    const revenuePrevMonth = getRevenueForPreviousMonth(currentDate);
    const totalExpensesForMonth = totalPendingBills + totalPaidBills;
    const netFlowProjected = monthlyRevenueForecast - totalExpensesForMonth;
    const projectedBalance = initialBalance + netFlowProjected;
    
    const status: 'success' | 'warning' | 'danger' = 
      projectedBalance >= 0 ? (projectedBalance > initialBalance ? 'success' : 'warning') : 'danger';

    return {
      initialBalance,
      revenuePrevMonth,
      projectedBalance,
      netFlowProjected,
      totalExpensesForMonth,
      status,
    };
  }, [currentDate, highLiquidityAccountIds, calculateBalanceUpToDate, transacoesV2, contasMovimento, getRevenueForPreviousMonth, monthlyRevenueForecast, totalPendingBills, totalPaidBills]);
  
  const handleUpdateForecast = () => {
    const parsed = parseFromBR(forecastInput);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Valor de previsão inválido.");
      return;
    }
    setMonthlyRevenueForecast(parsed);
    setForecastInput(formatToBR(parsed));
    toast.success("Previsão de receita atualizada!");
  };
  
  const handleSuggestForecast = () => {
    const suggestedValue = calculos.revenuePrevMonth;
    setForecastInput(formatToBR(suggestedValue));
    setMonthlyRevenueForecast(suggestedValue);
    toast.info("Previsão ajustada para a receita anterior.");
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d,.]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
    setForecastInput(value);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card shadow-none border-none bg-transparent">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <Wallet className="w-4 h-4" />
            RESUMO DE CAIXA
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold uppercase text-muted-foreground px-1">
              <span>Saldo Inicial</span>
              <span className="text-primary">{formatCurrency(calculos.initialBalance)}</span>
            </div>
            
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
              <Label className="text-[10px] uppercase font-extrabold tracking-widest text-muted-foreground flex items-center justify-between">
                  Previsão Receita ({format(currentDate, 'MMM')})
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 gap-1 hover:bg-primary/10 hover:text-primary" onClick={handleSuggestForecast}>
                      <RefreshCw className="w-2.5 h-2.5" /> Sugerir
                  </Button>
              </Label>
              <div className="flex gap-2">
                  <Input
                      type="text"
                      inputMode="decimal"
                      value={forecastInput}
                      onChange={handleInputChange}
                      onBlur={handleUpdateForecast}
                      className="h-8 text-xs font-bold bg-background/50"
                  />
                  <Button onClick={handleUpdateForecast} className="h-8 px-3 text-[10px] font-bold uppercase">
                      OK
                  </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <span className="text-destructive text-[11px] font-bold uppercase flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Despesas Totais
              </span>
              <span className="font-bold text-destructive text-sm">{formatCurrency(calculos.totalExpensesForMonth)}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 px-1">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Pendentes</span>
                <span className="text-xs font-bold text-destructive">{formatCurrency(totalPendingBills)}</span>
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Já Pagas</span>
                <span className="text-xs font-bold text-success">{formatCurrency(totalPaidBills)}</span>
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" /> Fluxo Líquido
              </span>
              <span className={cn(
                "font-bold text-sm",
                calculos.netFlowProjected >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(calculos.netFlowProjected)}
              </span>
            </div>
            
            <div className={cn(
              "flex flex-col gap-1 p-4 rounded-2xl border-2 transition-colors",
              calculos.status === 'success' && "bg-success/5 border-success/20 text-success",
              calculos.status === 'warning' && "bg-warning/5 border-warning/20 text-warning",
              calculos.status === 'danger' && "bg-destructive/5 border-destructive/20 text-destructive"
            )}>
              <span className="font-black text-[10px] uppercase tracking-[0.2em] opacity-70">
                Saldo Projetado
              </span>
              <span className="font-black text-2xl tracking-tighter">{formatCurrency(calculos.projectedBalance)}</span>
            </div>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}