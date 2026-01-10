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
  }> = [
    {
      id: "patrimonio",
      title: "Patrimônio",
      value: formatCurrency(data.patrimonioTotal),
      status: "neutral",
      icon: Target,
      tooltip: "Valor total dos ativos menos passivos.",
      color: "text-primary",
    },
    {
      id: "variacao",
      title: "Variação",
      value: formatCurrency(Math.abs(data.variacaoPatrimonio)),
      subtitle: `${isPositiveVariation ? "+" : ""}${data.variacaoPercentual.toFixed(1)}%`,
      status: isPositiveVariation ? "success" : "danger",
      icon: isPositiveVariation ? TrendingUp : TrendingDown,
      tooltip: "Mudança no patrimônio comparada ao período anterior.",
      color: isPositiveVariation ? "text-success" : "text-destructive",
    },
    {
      id: "liquidez",
      title: "Liquidez",
      value: formatCurrency(data.liquidezImediata),
      status: "info",
      icon: Droplets,
      tooltip: "Recursos disponíveis em contas de alta liquidez.",
      color: "text-info",
    },
    {
      id: "compromissos",
      title: "Compromissos",
      value: formatCurrency(data.compromissosMes),
      status: "warning",
      icon: CalendarClock,
      tooltip: "Despesas e parcelas no período atual.",
      color: "text-warning",
    },
    {
      id: "projecao",
      title: "Projeção",
      value: formatCurrency(Math.abs(data.projecao30Dias)),
      status: isPositiveProjection ? "success" : "danger",
      icon: isPositiveProjection ? ArrowUpRight : ArrowDownRight,
      tooltip: "Saldo líquido projetado para 30 dias.",
      color: isPositiveProjection ? "text-success" : "text-destructive",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {cards.map((card, index) => (
          <Tooltip key={card.id}>
            <TooltipTrigger asChild>
              <div className={cn(
                "glass-card p-4 md:p-5 rounded-[1.75rem] flex flex-col justify-between h-full transition-all hover:scale-[1.02] border-border/40",
                card.status === "success" && "stat-card-positive",
                card.status === "danger" && "stat-card-negative",
                card.status === "warning" && "stat-card-warning",
                card.status === "info" && "stat-card-info"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2.5 rounded-2xl bg-primary/10", card.color)}>
                    <card.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  {card.subtitle && (
                    <Badge variant="outline" className={cn("text-[10px] border-none font-bold", card.color)}>
                      {card.subtitle}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {card.title}
                  </p>
                  <p className="text-base md:text-xl font-black text-foreground truncate">
                    {card.value}
                  </p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-popover border-border">
              <p className="text-xs">{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}