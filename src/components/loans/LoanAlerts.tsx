import { useMemo } from "react";
import { 
  AlertTriangle, 
  Bell, 
  Calendar, 
  Trophy, 
  TrendingDown,
  CheckCircle2,
  Sparkles,
  Settings,
  ChevronRight
} from "lucide-react";
import { cn, getDueDate } from "@/lib/utils";
import { Emprestimo } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { differenceInDays, isBefore, isToday, isPast } from "date-fns";
import { Button } from "@/components/ui/button";

interface AlertItem {
  id: string;
  type: "warning" | "info" | "success" | "danger";
  icon: React.ElementType;
  title: string;
  description: string;
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
    if (nextDueDate && differenceInDays(nextDueDate, hoje) <= 7) items.push({ id: "next", type: "warning", icon: Calendar, title: "Vencimento Próximo", description: `Próxima parcela em ${differenceInDays(nextDueDate, hoje)} dias.` });
    if (totalJurosRestantes > 1000) items.push({ id: "save", type: "success", icon: TrendingDown, title: "Economia de Juros", description: `A quitação antecipada economiza até R$ ${totalJurosRestantes.toFixed(0)}.` });
    
    return items;
  }, [activeLoans, emprestimos, calculateLoanSchedule, calculatePaidInstallmentsUpToDate, onOpenPendingConfig]);

  const styles = {
    warning: "bg-warning/10 text-warning",
    info: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Insights e Alertas</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            onClick={alert.action}
            className={cn(
              "flex items-center gap-3 p-3.5 rounded-2xl transition-all border border-transparent hover:border-border/40 group",
              styles[alert.type],
              alert.action && "cursor-pointer active:scale-95"
            )}
          >
            <div className="p-2 rounded-xl bg-background/40">
              <alert.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight truncate">{alert.title}</p>
              <p className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">{alert.description}</p>
            </div>
            {alert.action && <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />}
          </div>
        ))}
      </div>
    </div>
  );
}