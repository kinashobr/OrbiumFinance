import { 
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  TrendingUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, parseDateLocal } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { TransacaoCompleta } from "@/types/finance";

interface MovimentacoesRelevantesProps {
  transacoes: TransacaoCompleta[];
  limit?: number;
}

const operationConfig: Record<string, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  receita: { icon: ArrowUpCircle, label: 'Receita', color: 'text-success', bgColor: 'bg-success/15' },
  despesa: { icon: ArrowDownCircle, label: 'Despesa', color: 'text-destructive', bgColor: 'bg-destructive/15' },
  aplicacao: { icon: TrendingUp, label: 'Aporte', color: 'text-info', bgColor: 'bg-info/15' },
  resgate: { icon: TrendingDown, label: 'Resgate', color: 'text-warning', bgColor: 'bg-warning/15' },
  rendimento: { icon: TrendingUp, label: 'Rendimento', color: 'text-success', bgColor: 'bg-success/15' },
};

export function MovimentacoesRelevantes({ transacoes, limit = 6 }: MovimentacoesRelevantesProps) {
  const navigate = useNavigate();

  const movimentacoes = [...transacoes]
    .filter(t => t.flow !== 'transfer_in' && t.flow !== 'transfer_out' && t.amount >= 50)
    .sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime())
    .slice(0, limit);

  const formatDate = (dateStr: string) => {
    const date = parseDateLocal(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoje';
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="glass-card p-6 rounded-[2.5rem] border-border/40 shadow-expressive">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-foreground tracking-tight">Movimentações</h3>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Eventos de impacto</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs font-black text-primary hover:bg-primary/10 rounded-full"
          onClick={() => navigate("/receitas-despesas")}
        >
          VER TUDO <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="space-y-1">
        {movimentacoes.map((mov) => {
          const config = operationConfig[mov.operationType] || operationConfig.despesa;
          const isIncome = mov.flow === 'in' || mov.flow === 'transfer_in';
          
          return (
            <div 
              key={mov.id}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-all cursor-pointer group active:scale-[0.98]"
              onClick={() => navigate("/receitas-despesas")}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", config.bgColor)}>
                  <config.icon className={cn("h-6 w-6", config.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {mov.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground/60">{formatDate(mov.date)}</span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-none px-0 text-muted-foreground/40">{config.label}</Badge>
                  </div>
                </div>
              </div>
              <span className={cn(
                "font-black text-sm whitespace-nowrap tabular-nums",
                isIncome ? "text-success" : "text-destructive"
              )}>
                {isIncome ? "+" : "-"} {formatCurrency(mov.amount)}
              </span>
            </div>
          );
        })}

        {movimentacoes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center opacity-40">
              <TrendingUpDown className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold">Sem movimentações recentes</p>
          </div>
        )}
      </div>
    </div>
  );
}