import { Target, TrendingUp, TrendingDown, CalendarClock, ArrowUpRight, ArrowDownRight, Droplets, Wallet, CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard, type KpiStatus } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

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

// Dummy data for the chart visualization
const chartData = [
  { name: 'A', value: 100 },
  { name: 'B', value: 130 },
  { name: 'C', value: 90 },
  { name: 'D', value: 150 },
  { name: 'E', value: 120 },
  { name: 'F', value: 180 },
];

export function CockpitCards({ data }: CockpitCardsProps) {
  const formatCurrency = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const isPositiveVariation = data.variacaoPatrimonio >= 0;
  const isPositiveProjection = data.projecao30Dias >= 0;

  const miniCards: Array<{
    id: string;
    title: string;
    value: string;
    icon: React.ElementType;
    trendLabel: string;
    color: string;
    bgColor: string;
  }> = [
    {
      id: "variacao",
      title: "Variação Mês",
      value: formatCurrency(Math.abs(data.variacaoPatrimonio), 1),
      icon: isPositiveVariation ? TrendingUp : TrendingDown,
      trendLabel: `${isPositiveVariation ? "+" : ""}${data.variacaoPercentual.toFixed(1)}%`,
      color: isPositiveVariation ? "text-success" : "text-destructive",
      bgColor: isPositiveVariation ? "bg-success/10" : "bg-destructive/10",
    },
    {
      id: "liquidez",
      title: "Liquidez Imediata",
      value: formatCurrency(data.liquidezImediata, 1),
      icon: Droplets,
      trendLabel: "Disponível",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: "compromissos",
      title: "Compromissos",
      value: formatCurrency(data.compromissosMes, 1),
      icon: CalendarClock,
      trendLabel: "Pendentes",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      id: "projecao",
      title: "Projeção 30D",
      value: formatCurrency(Math.abs(data.projecao30Dias), 1),
      icon: isPositiveProjection ? ArrowUpRight : ArrowDownRight,
      trendLabel: isPositiveProjection ? "Positiva" : "Negativa",
      color: isPositiveProjection ? "text-success" : "text-destructive",
      bgColor: isPositiveProjection ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Card Principal: Patrimônio Líquido (PL) */}
        <div className="col-span-1 lg:col-span-8 bg-card rounded-[var(--radius)] p-6 md:p-8 shadow-soft relative overflow-hidden border border-border/60 group h-[300px] flex flex-col justify-between">
          
          {/* Chart Background (Simulação de área) */}
          <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none opacity-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="plGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#plGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <div className="p-3 bg-primary/10 rounded-2xl backdrop-blur-sm">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div className="flex items-center gap-1 bg-success/10 px-3 py-1.5 rounded-full border border-success/20 backdrop-blur-md">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-bold text-success">
                {isPositiveVariation ? "+" : ""}{data.variacaoPercentual.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-auto pb-1">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Patrimônio Líquido</p>
            <p className="font-bold text-4xl md:text-5xl text-foreground tracking-tight leading-none">
              {formatCurrency(data.patrimonioTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {isPositiveVariation ? "Aumento" : "Redução"} de {formatCurrency(Math.abs(data.variacaoPatrimonio), 0)} este mês
            </p>
          </div>
        </div>

        {/* Mini Cards (4x) */}
        <div className="col-span-1 lg:col-span-4 grid grid-cols-2 gap-4 md:gap-6">
          {miniCards.map((card) => (
            <div 
              key={card.id}
              className={cn(
                "col-span-1 bg-card rounded-[var(--radius)] p-4 md:p-5 shadow-soft border border-border/60 flex flex-col justify-between h-36 hover:shadow-md transition-shadow",
                card.id === 'liquidez' && "border-l-4 border-l-primary",
                card.id === 'compromissos' && "border-l-4 border-l-warning",
                card.id === 'variacao' && (isPositiveVariation ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive"),
                card.id === 'projecao' && (isPositiveProjection ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive"),
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", card.bgColor, card.color)}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", card.bgColor, card.color)}>
                  {card.trendLabel}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{card.title}</p>
                <p className="font-bold text-xl text-foreground">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}