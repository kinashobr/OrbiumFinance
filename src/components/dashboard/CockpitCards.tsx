import { Target, TrendingUp, TrendingDown, CalendarClock, ArrowUpRight, ArrowDownRight, Droplets } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard, type KpiStatus } from "@/components/ui/KpiCard";

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const isPositiveVariation = data.variacaoPatrimonio >= 0;
  const isPositiveProjection = data.projecao30Dias >= 0;

  const cards: Array<{
    id: string;
    title: string;
    value: string;
    status: KpiStatus;
    icon: React.ReactNode;
    subtitle?: string;
    trend?: number;
    tooltip: string;
  }> = [
    {
      id: "patrimonio",
      title: "Patrimônio Total",
      value: formatCurrency(data.patrimonioTotal),
      status: data.patrimonioTotal >= 0 ? "neutral" : "danger",
      icon: <Target className="w-6 h-6" />,
      tooltip:
        "Valor total dos ativos (contas, investimentos, veículos) menos o total dos passivos (dívidas, cartões, seguros a pagar).",
    },
    {
      id: "variacao",
      title: "Variação do Período",
      value: formatCurrency(Math.abs(data.variacaoPatrimonio)),
      subtitle: `${isPositiveVariation ? "+" : ""}${data.variacaoPercentual.toFixed(1)}%`,
      status: isPositiveVariation ? "success" : "danger",
      icon: isPositiveVariation ? (
        <TrendingUp className="w-6 h-6" />
      ) : (
        <TrendingDown className="w-6 h-6" />
      ),
      tooltip:
        "Mudança líquida no patrimônio (Receitas - Despesas) comparada ao período anterior.",
    },
    {
      id: "liquidez",
      title: "Liquidez Imediata",
      value: formatCurrency(data.liquidezImediata),
      status: data.liquidezImediata > 0 ? "info" : "danger",
      icon: <Droplets className="w-6 h-6" />,
      tooltip:
        "Soma dos saldos em contas correntes, poupança, reserva de emergência e renda fixa de alta liquidez.",
    },
    {
      id: "compromissos",
      title: "Compromissos do Mês",
      value: formatCurrency(data.compromissosMes),
      status: "warning",
      icon: <CalendarClock className="w-6 h-6" />,
      tooltip: "Total de despesas e parcelas de empréstimos registradas no período atual.",
    },
    {
      id: "projecao",
      title: "Projeção 30 Dias",
      value: formatCurrency(Math.abs(data.projecao30Dias)),
      status: isPositiveProjection ? "success" : "danger",
      icon: isPositiveProjection ? (
        <ArrowUpRight className="w-6 h-6" />
      ) : (
        <ArrowDownRight className="w-6 h-6" />
      ),
      tooltip:
        "Estimativa do saldo líquido (Receitas - Despesas) projetado para os próximos 30 dias, baseada na média do período atual.",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {cards.map((card, index) => (
          <Tooltip key={card.id}>
            <TooltipTrigger asChild>
              <div>
                <KpiCard
                  title={card.title}
                  value={card.value}
                  subtitle={card.subtitle}
                  status={card.status}
                  icon={card.icon}
                  tooltip={card.tooltip}
                  delay={index * 40}
                  size="sm"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-popover border-border">
              <p className="text-sm">{card.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
