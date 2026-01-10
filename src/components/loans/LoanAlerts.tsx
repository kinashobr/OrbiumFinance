import { useMemo } from "react";
import { 
  AlertTriangle, 
  Calendar, 
  TrendingDown,
  Sparkles,
  Settings,
  ArrowRight
} from "lucide-react";
import { cn, getDueDate } from "@/lib/utils";
import { Emprestimo } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { differenceInDays, isBefore, isToday, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AlertItem {
  id: string;
  type: "warning" | "info" | "success" | "danger";
  icon: React.ElementType;
  title: string;
  description: string;
  value?: string; // Campo opcional para destacar valores
  action?: () => void;
}

interface LoanAlertsProps {
  emprestimos: Emprestimo[];
  className?: string;
  onOpenPendingConfig?: () => void;
}

export function LoanAlerts({ emprestimos, className, onOpenPendingConfig }: LoanAlertsProps) {
  const { calculateLoanSchedule, calculatePaidInstallmentsUpToDate } = useFinance();
  const hoje = new Date();
  const activeLoans = useMemo(() => emprestimos.filter(e => e.status === 'ativo' || e.status === 'pendente_config'), [emprestimos]);

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    let totalJurosRestantes = 0;
    let nextDueDate: Date | null = null;
    let hasOverdue = false;

    activeLoans.forEach(loan => {
      if (loan.status === 'pendente_config') return;
      const schedule = calculateLoanSchedule(loan.id);
      const paidCount = calculatePaidInstallmentsUpToDate(loan.id, hoje);
      schedule.forEach(item => { if (item.parcela > paidCount) totalJurosRestantes += item.juros; });
      for (let i = 1; i <= loan.meses; i++) {
        if (i > paidCount) {
          const dueDate = getDueDate(loan.dataInicio!, i);
          if (!nextDueDate || isBefore(dueDate, nextDueDate)) nextDueDate = dueDate;
          if (isPast(dueDate) && !isToday(dueDate)) hasOverdue = true;
          break;
        }
      }
    });

    const pendingLoans = emprestimos.filter(e => e.status === 'pendente_config');
    if (pendingLoans.length > 0) items.push({ id: "pend", type: "info", icon: Settings, title: "Configuração Pendente", description: "Há novos contratos aguardando detalhes.", action: onOpenPendingConfig });
    if (hasOverdue) items.push({ id: "over", type: "danger", icon: AlertTriangle, title: "Parcelas Atrasadas", description: "Verifique seu cronograma de pagamentos." });
    if (nextDueDate && differenceInDays(nextDueDate, hoje) <= 7) items.push({ id: "next", type: "warning", icon: Calendar, title: "Vencimento Próximo", description: `Sua próxima fatura vence em ${differenceInDays(nextDueDate, hoje)} dias.` });
    
    if (totalJurosRestantes > 1000) {
      items.push({ 
        id: "save", 
        type: "success", 
        icon: TrendingDown, 
        title: "Economia de Juros", 
        description: "Valor total de juros futuros que podem ser eliminados com a quitação antecipada.",
        value: `R$ ${totalJurosRestantes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
      });
    }
    
    return items;
  }, [activeLoans, emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate, onOpenPendingConfig]);

  const styles = {
    warning: { bg: "bg-warning/5 border-warning/20", iconBg: "bg-warning/10 text-warning", btn: "text-warning hover:bg-warning/10" },
    info: { bg: "bg-primary/5 border-primary/20", iconBg: "bg-primary/10 text-primary", btn: "text-primary hover:bg-primary/10" },
    success: { bg: "bg-success/5 border-success/20", iconBg: "bg-success/10 text-success", btn: "text-success hover:bg-success/10" },
    danger: { bg: "bg-destructive/5 border-destructive/20", iconBg: "bg-destructive/10 text-destructive", btn: "text-destructive hover:bg-destructive/10" },
  };

  if (alerts.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Insights do Motor de Análise</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {alerts.map((alert) => {
          const style = styles[alert.type];
          const isSaveCard = alert.id === 'save';

          return (
            <div
              key={alert.id}
              className={cn(
                "flex flex-col p-6 rounded-[2.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                style.bg,
                isSaveCard && "sm:col-span-1"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-3 rounded-2xl shadow-sm", style.iconBg)}>
                  <alert.icon className="w-6 h-6" />
                </div>
                <Badge variant="outline" className={cn("border-none font-black text-[9px] px-2 py-1 rounded-lg", style.iconBg)}>
                  {alert.type.toUpperCase()}
                </Badge>
              </div>
              
              <div className="flex-1 space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{alert.title}</p>
                {alert.value ? (
                  <div className="space-y-1">
                    <p className="text-4xl font-black text-foreground tracking-tighter tabular-nums">{alert.value}</p>
                    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed max-w-[200px]">{alert.description}</p>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-foreground leading-tight">{alert.description}</p>
                )}
              </div>

              {alert.action && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={alert.action}
                  className={cn("mt-6 w-full justify-between rounded-xl font-black text-[10px] uppercase tracking-[0.15em] h-11 border border-current/10", style.btn)}
                >
                  Configurar Contrato
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}