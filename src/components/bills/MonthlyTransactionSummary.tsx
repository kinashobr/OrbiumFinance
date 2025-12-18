import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, ArrowLeftRight, FileText } from "lucide-react";
import { TransacaoCompleta, formatCurrency } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { cn, parseDateLocal } from "@/lib/utils";
import { format } from "date-fns";

interface MonthlyTransactionSummaryProps {
  transactions: TransacaoCompleta[];
  referenceDate: Date;
}

export function MonthlyTransactionSummary({ transactions, referenceDate }: MonthlyTransactionSummaryProps) {
  const { categoriasV2, contasMovimento } = useFinance();
  const categoriesMap = useMemo(() => new Map(categoriasV2.map(c => [c.id, c])), [categoriasV2]);
  const accountsMap = useMemo(() => new Map(contasMovimento.map(a => [a.id, a])), [contasMovimento]);

  // Filtra e ordena transações relevantes (excluindo saldos iniciais e transferências internas)
  const relevantTransactions = useMemo(() => {
    return transactions
      .filter(t => 
        t.operationType !== 'initial_balance' && 
        t.flow !== 'transfer_in' && 
        t.flow !== 'transfer_out'
      )
      .sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime());
  }, [transactions]);

  const summary = useMemo(() => {
    const totalIn = relevantTransactions
      .filter(t => t.flow === 'in')
      .reduce((acc, t) => acc + t.amount, 0);
      
    const totalOut = relevantTransactions
      .filter(t => t.flow === 'out')
      .reduce((acc, t) => acc + t.amount, 0);
      
    const balance = totalIn - totalOut;
    
    return { totalIn, totalOut, balance };
  }, [relevantTransactions]);

  const getCategoryLabel = (id: string | null) => {
    if (!id) return '—';
    const cat = categoriesMap.get(id);
    return cat ? `${cat.icon || ''} ${cat.label}` : 'Outros';
  };
  
  const getAccountName = (id: string) => accountsMap.get(id)?.name || 'N/A';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Fluxo de Caixa Real ({format(referenceDate, 'MMMM/yyyy')})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Resumo Financeiro */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-sm font-semibold text-success">{formatCurrency(summary.totalIn)}</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="text-sm font-semibold text-destructive">{formatCurrency(summary.totalOut)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Balanço</p>
            <p className={cn("text-sm font-semibold", summary.balance >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>

        <ScrollArea className="h-[400px] border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[80px]">Data</TableHead>
                <TableHead className="w-[120px]">Conta</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[150px]">Categoria</TableHead>
                <TableHead className="w-[120px] text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relevantTransactions.map((t) => {
                const isIncome = t.flow === 'in';
                const Icon = isIncome ? TrendingUp : TrendingDown;
                const color = isIncome ? 'text-success' : 'text-destructive';
                
                return (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {parseDateLocal(t.date).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {getAccountName(t.accountId)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {t.description}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getCategoryLabel(t.categoryId)}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium text-sm whitespace-nowrap", color)}>
                      <div className="flex items-center justify-end gap-1">
                        <Icon className="w-3 h-3" />
                        {formatCurrency(t.amount)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {relevantTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma transação registrada neste mês.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}