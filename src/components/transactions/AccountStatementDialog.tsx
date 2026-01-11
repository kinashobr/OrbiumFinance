import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, Calendar, TrendingUp, TrendingDown, 
  CheckCircle2, AlertTriangle, Download, RefreshCw, X, ArrowRight
} from "lucide-react";
import { 
  ContaCorrente, TransacaoCompleta, Categoria, AccountSummary, 
  formatCurrency, ACCOUNT_TYPE_LABELS 
} from "@/types/finance";
import { TransactionTable } from "./TransactionTable";
import { cn, parseDateLocal } from "@/lib/utils";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ContaCorrente;
  accountSummary: AccountSummary;
  transactions: TransacaoCompleta[];
  categories: Categoria[];
  onEditTransaction: (transaction: TransacaoCompleta) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleConciliated: (id: string, value: boolean) => void;
  onReconcileAll: () => void;
}

export function AccountStatementDialog({
  open,
  onOpenChange,
  account,
  accountSummary,
  transactions,
  categories,
  onEditTransaction,
  onDeleteTransaction,
  onToggleConciliated,
  onReconcileAll
}: AccountStatementDialogProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(""); 

  // Filtrar transações por período
  const filteredTransactions = useMemo(() => {
    const fromDate = dateFrom ? startOfDay(parseDateLocal(dateFrom)) : undefined;
    const toDate = dateTo ? endOfDay(parseDateLocal(dateTo)) : undefined;

    return transactions
      .filter(t => {
        const transactionDate = parseDateLocal(t.date);
        
        const matchFrom = !fromDate || transactionDate >= fromDate;
        const matchTo = !toDate || transactionDate <= toDate;
        
        return matchFrom && matchTo;
      })
      .sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime());
  }, [transactions, dateFrom, dateTo]);

  // O resumo do período é fornecido pelo accountSummary (calculado em ReceitasDespesas.tsx)
  const periodSummary = useMemo(() => {
    const { initialBalance, currentBalance, totalIn, totalOut } = accountSummary;
    
    // Contagem de conciliação baseada nas transações filtradas (não no resumo do período)
    const conciliatedCount = filteredTransactions.filter(t => t.conciliated).length;
    const pendingCount = filteredTransactions.length - conciliatedCount;

    return {
      initialBalance,
      finalBalance: currentBalance,
      totalIn,
      totalOut,
      netChange: totalIn - totalOut,
      conciliatedCount,
      pendingCount,
    };
  }, [accountSummary, filteredTransactions]);

  const statusColor = periodSummary.pendingCount === 0 ? 'text-success' : 'text-warning';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,80rem)] h-[min(90vh,900px)] p-0 overflow-hidden flex flex-col rounded-[3rem] border-none shadow-2xl bg-background">
        <DialogHeader className="px-8 pt-10 pb-6 border-b shrink-0 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary shadow-lg shadow-primary/5">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-black tracking-tight truncate">{account.name}</DialogTitle>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-muted/50 border-none">{ACCOUNT_TYPE_LABELS[account.accountType]}</Badge>
                  {account.institution && <span className="truncate">• {account.institution}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button variant="outline" size="sm" onClick={onReconcileAll} className="h-10 rounded-full text-xs sm:text-sm font-bold gap-2 px-5 border-border/40 bg-card/50 backdrop-blur-sm">
                <RefreshCw className="w-4 h-4" />
                Conciliar Tudo
              </Button>
              <Button variant="outline" size="sm" className="h-10 rounded-full text-xs sm:text-sm font-bold gap-2 px-5 border-border/40 bg-card/50 backdrop-blur-sm">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-10 w-10 rounded-full hover:bg-black/5 transition-colors">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo rolável */}
        <ScrollArea className="flex-1 hide-scrollbar-mobile">
          <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            {/* Status de Conciliação */}
            <div className={cn(
              "p-5 rounded-[2rem] border-2 flex items-center justify-between transition-all",
              periodSummary.pendingCount === 0 ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn("flex items-center gap-2", statusColor)}>
                  {periodSummary.pendingCount === 0 ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                  <span className="font-black text-sm uppercase tracking-widest">
                    {periodSummary.pendingCount === 0 
                      ? "Conciliação Completa" 
                      : `${periodSummary.pendingCount} PENDENTE(S)`}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-6 bg-border/50 hidden sm:block" />
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {periodSummary.conciliatedCount}/{transactions.length} transações
                </span>
              </div>

              <Badge variant="outline" className={cn(
                "font-black text-sm px-4 py-1.5 rounded-xl",
                periodSummary.netChange >= 0 ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"
              )}>
                {periodSummary.netChange >= 0 ? "+" : ""}{formatCurrency(periodSummary.netChange)}
              </Badge>
            </div>

            {/* Resumo de Saldos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="glass-card p-4 rounded-[2rem]">
                <CardContent className="p-0">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Inicial</div>
                  <div className="text-lg font-black">{formatCurrency(periodSummary.initialBalance)}</div>
                </CardContent>
              </Card>
              
              <Card className="glass-card p-4 rounded-[2rem] bg-success/5 border-success/20">
                <CardContent className="p-0">
                  <div className="flex items-center gap-1 text-[10px] font-black text-success uppercase tracking-widest mb-1">
                    <TrendingUp className="w-3 h-3" /> Entradas
                  </div>
                  <div className="text-lg font-black text-success">
                    +{formatCurrency(periodSummary.totalIn)}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card p-4 rounded-[2rem] bg-destructive/5 border-destructive/20">
                <CardContent className="p-0">
                  <div className="flex items-center gap-1 text-[10px] font-black text-destructive uppercase tracking-widest mb-1">
                    <TrendingDown className="w-3 h-3" /> Saídas
                  </div>
                  <div className="text-lg font-black text-destructive">
                    -{formatCurrency(periodSummary.totalOut)}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card p-4 rounded-[2rem] border-primary/20 bg-primary/5">
                <CardContent className="p-0">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Final</div>
                  <div className={cn(
                    "text-lg font-black",
                    periodSummary.finalBalance >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    {formatCurrency(periodSummary.finalBalance)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtro de Período */}
            <div className="glass-card p-6 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">
                  Filtro de Período
                </CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <span className="text-xs sm:text-sm text-muted-foreground font-bold">De:</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 h-10 text-sm rounded-xl border-2 bg-muted/50"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <span className="text-xs sm:text-sm text-muted-foreground font-bold">Até:</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 h-10 text-sm rounded-xl border-2 bg-muted/50"
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-4 sm:ml-auto">
                  {(dateFrom || dateTo) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-10 text-xs sm:text-sm rounded-xl font-bold gap-2"
                      onClick={() => { setDateFrom(""); setDateTo(""); }}
                    >
                      <X className="w-4 h-4" /> Limpar
                    </Button>
                  )}
                  <span className="text-xs sm:text-sm text-muted-foreground font-bold">
                    {filteredTransactions.length} transações
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="glass-card p-0 rounded-[2rem]">
              <CardHeader className="pb-4 px-6 sm:px-8 pt-6 sm:pt-8">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  Movimentações Detalhadas
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0 sm:px-0 pb-6 sm:pb-8">
                <div className="min-w-[1000px] px-6 sm:px-8">
                  <TransactionTable
                    transactions={filteredTransactions}
                    accounts={[account]}
                    categories={categories}
                    onEdit={onEditTransaction}
                    onDelete={onDeleteTransaction}
                    onToggleConciliated={onToggleConciliated}
                  />
                </div>
              </CardContent>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}