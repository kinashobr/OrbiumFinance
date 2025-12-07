"use client";

import { useState } from "react";
import { AlertTriangle, Info, CheckCircle, X, ChevronRight, Bell, TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";

interface Alerta {
  id: string;
  tipo: "warning" | "danger" | "info" | "success";
  mensagem: string;
  detalhe?: string;
  data?: string;
}

interface AlertasFinanceirosProps {
  alertas: Alerta[];
  onVerDetalhes?: (alertaId: string) => void;
  onIgnorar?: (alertaId: string) => void;
}

export function AlertasFinanceiros({ alertas: initialAlertas, onVerDetalhes, onIgnorar }: AlertasFinanceirosProps) {
  const { transacoes, emprestimos, getTotalReceitas, getTotalDespesas } = useFinance();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alertas = useState(() => {
    const hoje = new Date();
    const currentMonth = hoje.getMonth();
    const currentYear = hoje.getFullYear();
    
    const transacoesMes = transacoes.filter(t => {
      const date = new Date(t.data);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    const receitasMes = transacoesMes.filter(t => t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const despesasMes = transacoesMes.filter(t => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0);
    const saldoMes = receitasMes - despesasMes;
    
    const alertasDinamicos: Alerta[] = [];
    
    if (despesasMes > receitasMes) {
      alertasDinamicos.push({
        id: "saldo-negativo",
        tipo: "danger",
        mensagem: "Saldo negativo no mês",
        detalhe: `Despesas R$ ${despesasMes.toLocaleString("pt-BR")} > Receitas R$ ${receitasMes.toLocaleString("pt-BR")}`,
      });
    }
    
    const despesasFixas = transacoesMes
      .filter(t => ["Moradia", "Saúde", "Transporte", "Salário"].includes(t.categoria) && t.tipo === "despesa")
      .reduce((acc, t) => acc + t.valor, 0);
    
    const indiceEndividamento = receitasMes > 0 ? (despesasFixas / receitasMes) * 100 : 0;
    if (indiceEndividamento > 50) {
      alertasDinamicos.push({
        id: "endividamento-alto",
        tipo: "warning",
        mensagem: "Endividamento acima de 50%",
        detalhe: `Despesas fixas representam ${indiceEndividamento.toFixed(1)}% da renda`,
      });
    }
    
    const proximoVencimento = emprestimos.length > 0 ? new Date() : null;
    if (proximoVencimento) {
      proximoVencimento.setDate(proximoVencimento.getDate() + 10);
      alertasDinamicos.push({
        id: "emprestimo-vencimento",
        tipo: "info",
        mensagem: "Próximo vencimento de empréstimo",
        detalhe: `Em ${proximoVencimento.toLocaleDateString("pt-BR")}`,
      });
    }
    
    return [...alertasDinamicos, ...initialAlertas];
  })[0];

  const visibleAlertas = alertas.filter(a => !dismissed.has(a.id));

  const handleDismiss = (alertaId: string) => {
    setDismissed(prev => new Set([...prev, alertaId]));
    onIgnorar?.(alertaId);
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "danger": return AlertTriangle;
      case "warning": return AlertTriangle;
      case "success": return CheckCircle;
      default: return Info;
    }
  };

  const getStyles = (tipo: string) => {
    switch (tipo) {
      case "danger": return "border-l-destructive bg-destructive/10 text-destructive";
      case "warning": return "border-l-warning bg-warning/10 text-warning";
      case "success": return "border-l-success bg-success/10 text-success";
      default: return "border-l-primary bg-primary/10 text-primary";
    }
  };

  if (visibleAlertas.length === 0) {
    return (
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Alertas Financeiros</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="h-5 w-5 mr-2 text-success" />
          Nenhum alerta no momento
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Alertas Financeiros</h3>
          <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
            {visibleAlertas.length}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
        {visibleAlertas.map((alerta) => {
          const Icon = getIcon(alerta.tipo);
          return (
            <div
              key={alerta.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border-l-4 transition-all hover:scale-[1.01]",
                getStyles(alerta.tipo)
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{alerta.mensagem}</p>
                  {alerta.detalhe && (
                    <p className="text-xs text-muted-foreground mt-0.5">{alerta.detalhe}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onVerDetalhes?.(alerta.id)}
                >
                  Ver <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDismiss(alerta.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}