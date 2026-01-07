import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, Wallet, RefreshCw, Calculator, DollarSign } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { formatCurrency } from "@/types/finance";
import { cn } from "@/lib/utils";
import { startOfMonth, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    
    // Saldo Inicial (Caixa)
    const initialBalance = highLiquidityAccountIds.reduce((acc, accountId) => {
      const balance = calculateBalanceUpToDate(accountId, dayBeforeStart, transacoesV2, contasMovimento);
      return acc + balance;
    }, 0);

    const revenuePrevMonth = getRevenueForPreviousMonth(currentDate);
    const totalExpensesForMonth = totalPendingBills + totalPaidBills;
    const netFlowProjected = monthlyRevenueForecast - totalExpensesForMonth;
    const projectedBalance = initialBalance + netFlowProjected;
    
    return { 
      initialBalance, 
      revenuePrevMonth, 
      projectedBalance, 
      netFlowProjected, 
      totalExpensesForMonth 
    };
  }, [currentDate, highLiquidityAccountIds, calculateBalanceUpToDate, transacoesV2, contasMovimento, getRevenueForPreviousMonth, monthlyRevenueForecast, totalPendingBills, totalPaidBills]);
  
  const handleUpdateForecast = () => {
    const parsed = parseFromBR(forecastInput);
    setMonthlyRevenueForecast(parsed);
    toast.success("Previsão atualizada!");
  };
  
  const handleSuggestForecast = () => {
    const suggestion = calculos.revenuePrevMonth;
    setForecastInput(formatToBR(suggestion));
    setMonthlyRevenueForecast(suggestion);
  };

  const monthLabel = format(currentDate, 'MMM', { locale: ptBR });

  return (
    <div className="w-full">
      <Card className="glass-card border-none shadow-none bg-transparent space-y-5">
        
        {/* Título */}
        <div className="flex items-center gap-2 text-primary">
          <Wallet className="w-4 h-4" />
          <h3 className="cq-text-sm font-bold">Fluxo de Caixa Projetado</h3>
        </div>

        {/* Saldo Inicial */}
        <div className="flex justify-between items-center p-3 rounded-xl bg-muted/40">
           <span className="text-muted-foreground cq-text-xs font-medium">Saldo Inicial (Caixa)</span>
           <span className="font-bold text-primary cq-text-sm">
             {formatCurrency(calculos.initialBalance)}
           </span>
        </div>

        {/* Previsão de Receita */}
        <div className="space-y-2">
           <div className="flex justify-between items-center">
             <span className="text-muted-foreground cq-text-xs font-medium">
               Previsão de Receita ({monthLabel})
             </span>
             <button 
                onClick={handleSuggestForecast}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cq-text-xs"
             >
               <RefreshCw className="w-3 h-3" /> 
               Sugerir ({formatCurrency(calculos.revenuePrevMonth)})
             </button>
           </div>
           <div className="flex gap-2">
             <Input 
                type="text"
                inputMode="decimal"
                value={forecastInput}
                onChange={(e) => setForecastInput(e.target.value)}
                className="h-9 cq-text-sm bg-background/50 border-border/50 rounded-xl flex-1"
             />
             <Button 
                onClick={handleUpdateForecast}
                className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl cq-text-xs font-bold"
             >
               Salvar
             </Button>
           </div>
        </div>

        <Separator className="bg-border/40" />

        {/* Bloco de Despesas */}
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-destructive/10 flex justify-between items-center text-destructive">
             <div className="flex items-center gap-2">
               <TrendingDown className="w-4 h-4" />
               <span className="font-bold cq-text-sm">Despesas Totais (Mês)</span>
             </div>
             <span className="font-bold cq-text-sm">
               {formatCurrency(calculos.totalExpensesForMonth)}
             </span>
          </div>

          <div className="px-1 space-y-2">
             <div className="flex justify-between cq-text-xs">
               <span className="text-muted-foreground">Pendentes + Cartão</span>
               <span className="text-destructive font-bold">{formatCurrency(totalPendingBills)}</span>
             </div>
             <div className="flex justify-between cq-text-xs">
               <span className="text-muted-foreground">Pago (Débito/Dinheiro)</span>
               <span className="text-success font-bold">{formatCurrency(totalPaidBills)}</span>
             </div>
          </div>
        </div>

        <Separator className="bg-border/40" />

        {/* Fluxo Líquido */}
        <div className="flex justify-between items-center cq-text-xs px-1">
           <div className="flex items-center gap-2 text-muted-foreground font-medium">
             <Calculator className="w-4 h-4" />
             <span>Fluxo Líquido Projetado</span>
           </div>
           <span className={cn(
             "font-bold", 
             calculos.netFlowProjected >= 0 ? "text-success" : "text-destructive"
           )}>
             {calculos.netFlowProjected > 0 ? '+' : ''}{formatCurrency(calculos.netFlowProjected)}
           </span>
        </div>

        {/* Saldo Projetado Final */}
        <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 flex justify-between items-center shadow-sm">
           <span className="font-bold text-primary cq-text-xs uppercase leading-tight tracking-tight">
             SALDO PROJETADO<br/>(COM CAIXA)
           </span>
           <span className="font-black cq-text-xl text-primary">
             {formatCurrency(calculos.projectedBalance)}
           </span>
        </div>

      </Card>
    </div>
  );
}