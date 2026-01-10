import { Target, TrendingUp, TrendingDown, CalendarClock, ArrowUpRight, ArrowDownRight, Droplets } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard, type KpiStatus } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CockpitData {
  patrimonioTotal: number;
  variacaoPatrimonio: number;
  variacaoPercentual: number;
  liquidezImediata: number;
  compromissosMes: number;
  projecao30Dias: number;
}

interface CockpitCardsProps {
  data: CockpitData;
}

export function CockpitCards({ data }: CockpitCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isPositiveVariation = data.variacaoPatrimonio >= 0;
  const isPositiveProjection = data.projecao30Dias >= 0;

  const cards: Array<{
    id: string;
    title: string;
    value: string;
    status: KpiStatus;
    icon: React.ElementType;
    subtitle?: string;
    tooltip: string;
    color: string;
    bgColor: string;
  }> = [
    {
      id: "patrimonio",
      title: "Patrimônio",
      value: formatCurrency(data.patrimonioTotal),
      status: "neutral",
      icon: Target,
      tooltip: "Valor total dos ativos menos passivos acumulados.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: "variacao",
      title: "Variação",
      value: formatCurrency(Math.abs(data.variacaoPatrimonio)),
      subtitle: `${isPositiveVariation ? "+" : ""}${data.variacaoPercentual.toFixed(1)}%`,
      status: isPositiveVariation ? "success" : "danger",
      icon: isPositiveVariation ? TrendingUp : TrendingDown,
      tooltip: "Diferença patrimonial entre o período atual e o anterior.",
      color: isPositiveVariation ? "text-success" : "text-destructive",
      bgColor: isPositiveVariation ? "bg-success/10" : "bg-destructive/10",
    },
    {
      id: "liquidez",
      title: "Liquidez",
      value: formatCurrency(data.liquidezImediata),
      status: "info",
      icon: Droplets,
      tooltip: "Capital disponível em contas de resgate imediato.",
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      id: "compromissos",
      title: "Compromissos",
      value: formatCurrency(data.compromissosMes),
      status: "warning",
      icon: CalendarClock,
      tooltip: "Total de despesas e parcelas provisionadas no período.",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      id: "projecao",
      title: "Projeção",
      value: formatCurrency(Math.abs(data.projecao30Dias)),
      status: isPositiveProjection ? "success" : "danger",
      icon: isPositiveProjection ? ArrowUpRight : ArrowDownRight,
      tooltip: "Estimativa de saldo líquido após 30 dias com base no fluxo atual.",
      color: isPositiveProjection ? "text-success" : "text-destructive",
      bgColor: isPositiveProjection ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        {cards.map((card) => (
          <Tooltip key={card.id}>
            <TooltipTrigger asChild>
              <div className={cn(
                "glass-card p-5 rounded-[2.25rem] flex flex-col justify-between h-44 transition-all hover:scale-[1.03] active:scale-[0.98] border-border/40 group",
                card.status === "success" && "stat-card-positive",
                card.status === "danger" && "stat-card-negative",
                card.status === "warning" && "stat-card-warning",
                card.status === "info" && "stat-card-info"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-2xl transition-transform group-hover:rotate-12", card.bgColor, card.color)}>
                    <card.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  {card.subtitle && (
                    <Badge variant="outline" className={cn("text-[10px] md:text-xs border-none font-black px-2 py-0.5 rounded-full", card.bgColor, card.color)}>
                      {card.subtitle}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">
                    {card.title}
                  </p>
                  <p className="text-lg md:text-2xl font-black text-foreground truncate">
                    {card.value}
                  </p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-popover border-border px-3 py-2 shadow-xl rounded-xl max-w-xs">
              <p className="text-xs font-medium leading-relaxed">{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}