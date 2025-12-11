import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw,
  Banknote,
  Shield,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  receita: { icon: ArrowUpCircle, label: 'Entrada', color: 'text-success', bgColor: 'bg-success/10' },
  despesa: { icon: ArrowDownCircle, label: 'Saída', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  aplicacao: { icon: TrendingUp, label: 'Aplicação', color: 'text-info', bgColor: 'bg-info/10' },
  resgate: { icon: TrendingDown, label: 'Resgate', color: 'text-warning', bgColor: 'bg-warning/10' },
  transferencia: { icon: RefreshCw, label: 'Transferência', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  pagamento_emprestimo: { icon: Banknote, label: 'Pagamento', color: 'text-primary', bgColor: 'bg-primary/10' },
  rendimento: { icon: TrendingUp, label: 'Rendimento', color: 'text-success', bgColor: 'bg-success/10' },
  seguro: { icon: Shield, label: 'Seguro', color: 'text-warning', bgColor: 'bg-warning/10' },
};

export function MovimentacoesRelevantes({ transacoes, limit = 6 }: MovimentacoesRelevantesProps) {
  const navigate = useNavigate();

  // Filtrar apenas movimentações relevantes (valores significativos)
  const movimentacoesRelevantes = [...transacoes]
    .filter(t => {
      // Excluir transferências internas e valores muito pequenos
      const isRelevant = t.flow !== 'transfer_in' && 
                        t.flow !== 'transfer_out' &&
                        t.amount >= 100;
      return isRelevant;
    })
    .sort((a, b) => {
      // Ordenar por data mais recente, depois por valor
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.amount - a.amount;
    })
    .slice(0, limit);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getConfig = (operationType: string) => {
    return operationConfig[operationType] || operationConfig.despesa;
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Movimentações Relevantes</h3>
          <p className="text-xs text-muted-foreground">Eventos financeiros mais importantes</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs"
          onClick={() => navigate("/receitas-despesas")}
        >
          Ver todas <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="space-y-2">
        {movimentacoesRelevantes.map((mov) => {
          const config = getConfig(mov.operationType);
          const Icon = config.icon;
          const isIncome = mov.flow === 'in' || mov.flow === 'transfer_in';
          
          return (
            <div 
              key={mov.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {mov.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(mov.date)}
                    </span>
                  </div>
                </div>
              </div>
              <span className={cn(
                "font-semibold text-sm whitespace-nowrap",
                isIncome ? "text-success" : "text-destructive"
              )}>
                {isIncome ? "+" : "-"} {formatCurrency(mov.amount)}
              </span>
            </div>
          );
        })}

        {movimentacoesRelevantes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhuma movimentação relevante</p>
            <p className="text-xs mt-1">Registre transações em Receitas & Despesas</p>
          </div>
        )}
      </div>
    </div>
  );
}
