import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Wallet,
  Scale,
  Activity,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";

interface IndicadorSaude {
  id: string;
  nome: string;
  valor: number;
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  descricao: string;
  valorBruto: number;
  icon: React.ElementType;
  unit: string;
}

interface SaudeFinanceiraProps {
  liquidez: number;
  endividamento: number;
  diversificacao: number;
  estabilidadeFluxo: number;
  dependenciaRenda: number;
}

const statusConfig = {
  otimo: { color: 'text-success', bgColor: 'bg-success/10', label: 'ÓTIMO', icon: CheckCircle2 },
  bom: { color: 'text-info', bgColor: 'bg-info/10', label: 'BOM', icon: CheckCircle2 },
  atencao: { color: 'text-warning', bgColor: 'bg-warning/10', label: 'ATENÇÃO', icon: AlertTriangle },
  critico: { color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'CRÍTICO', icon: XCircle },
};

export function SaudeFinanceira({
  liquidez,
  endividamento,
  estabilidadeFluxo,
}: SaudeFinanceiraProps) {
  
  const getStatusLiquidez = (valor: number): IndicadorSaude['status'] => {
    if (valor >= 2.0) return 'otimo';
    if (valor >= 1.5) return 'bom';
    if (valor >= 1.0) return 'atencao';
    return 'critico';
  };

  const getStatusEndividamento = (valor: number): IndicadorSaude['status'] => {
    if (valor <= 20) return 'otimo';
    if (valor <= 35) return 'bom';
    if (valor <= 50) return 'atencao';
    return 'critico';
  };

  const getStatusEstabilidade = (valor: number): IndicadorSaude['status'] => {
    if (valor >= 80) return 'otimo';
    if (valor >= 60) return 'bom';
    if (valor >= 40) return 'atencao';
    return 'critico';
  };
  
  const getStatusCobertura = (valor: number): IndicadorSaude['status'] => {
    if (valor >= 6) return 'otimo';
    if (valor >= 3) return 'bom';
    return 'critico';
  };

  const indicadores: IndicadorSaude[] = [
    { 
      id: 'liquidez', 
      nome: 'Liquidez Geral', 
      valor: liquidez, 
      status: getStatusLiquidez(liquidez), 
      icon: Wallet, 
      valorBruto: liquidez,
      descricao: "Capacidade de cobrir passivos com seus ativos atuais. Ideal: > 2.0x",
      unit: 'x'
    },
    { 
      id: 'endividamento', 
      nome: 'Endividamento', 
      valor: endividamento, 
      status: getStatusEndividamento(endividamento), 
      icon: Scale, 
      valorBruto: endividamento,
      descricao: "Percentual do seu patrimônio comprometido com terceiros. Ideal: < 20%",
      unit: '%'
    },
    { 
      id: 'estabilidade', 
      nome: 'Estabilidade Fluxo', 
      valor: estabilidadeFluxo, 
      status: getStatusEstabilidade(estabilidadeFluxo), 
      icon: Activity, 
      valorBruto: estabilidadeFluxo,
      descricao: "Percentual de meses com saldo positivo nos últimos 6 meses. Ideal: > 80%",
      unit: '%'
    },
    { 
      id: 'cobertura', 
      nome: 'Meses de Cobertura', 
      valor: 6,
      status: getStatusCobertura(6), 
      icon: ShieldCheck, 
      valorBruto: 6,
      descricao: "Meses que a reserva de emergência cobre os custos mensais. Ideal: > 6 meses",
      unit: ' Meses'
    },
  ];

  const scoreGeral = indicadores.reduce((acc, ind) => {
    const score = ind.status === 'otimo' ? 100 : ind.status === 'bom' ? 75 : ind.status === 'atencao' ? 50 : 25;
    return acc + score;
  }, 0) / indicadores.length;
  
  const statusGeral = scoreGeral >= 75 ? 'otimo' : scoreGeral >= 55 ? 'bom' : scoreGeral >= 35 ? 'atencao' : 'critico';
  const configGeral = statusConfig[statusGeral];

  const formatValue = (value: number, unit: string) => {
    if (unit === 'x') return value.toFixed(1);
    if (unit === '%') return value.toFixed(0);
    return value.toFixed(0);
  };

  return (
    <TooltipProvider>
      <Card className="glass-card p-6 rounded-[var(--radius)] border-border/60 shadow-expressive">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-foreground tracking-tight">Saúde Financeira</h3>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Indicadores Sintéticos</p>
          </div>
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border border-current transition-all", configGeral.color, configGeral.bgColor)}>
            <configGeral.icon className="h-4 w-4" />
            <span className="text-xs font-black uppercase">{configGeral.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {indicadores.map((ind) => {
            const config = statusConfig[ind.status];
            const Icon = ind.icon;
            
            return (
              <Tooltip key={ind.id}>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "rounded-[var(--radius)] p-5 border relative group cursor-help",
                      config.bgColor,
                      config.color,
                      ind.status === 'otimo' && "border-success/20",
                      ind.status === 'bom' && "border-info/20",
                      ind.status === 'atencao' && "border-warning/20",
                      ind.status === 'critico' && "border-destructive/20",
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-sm">
                        <Icon className={cn("w-5 h-5", config.color)} />
                      </div>
                      <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full", config.bgColor, config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-3xl font-bold mb-1">
                      {formatValue(ind.valorBruto, ind.unit)}
                      {ind.unit !== '%' && ind.unit !== 'x' && <span className="text-sm ml-1">{ind.unit}</span>}
                    </p>
                    <p className="text-xs font-semibold opacity-70 mt-1">{ind.nome}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-3 bg-popover/95 border-border rounded-2xl shadow-2xl max-w-[200px]">
                  <p className="font-black text-xs mb-1">{ind.nome}</p>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-tight">{ind.descricao}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </Card>
    </TooltipProvider>
  );
}