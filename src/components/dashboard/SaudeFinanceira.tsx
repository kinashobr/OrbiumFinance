import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Wallet,
  Scale,
  Activity,
  Briefcase,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IndicadorSaude {
  id: string;
  nome: string;
  valor: number;
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  descricao: string;
  valorBruto: number;
}

interface SaudeFinanceiraProps {
  liquidez: number;
  endividamento: number;
  diversificacao: number;
  estabilidadeFluxo: number;
  dependenciaRenda: number;
}

const statusConfig = {
  otimo: { color: 'text-success', bgColor: 'bg-success/15', icon: CheckCircle2, label: 'Ótimo' },
  bom: { color: 'text-info', bgColor: 'bg-info/15', icon: Shield, label: 'Bom' },
  atencao: { color: 'text-warning', bgColor: 'bg-warning/15', icon: AlertTriangle, label: 'Atenção' },
  critico: { color: 'text-destructive', bgColor: 'bg-destructive/15', icon: XCircle, label: 'Crítico' },
};

export function SaudeFinanceira({
  liquidez,
  endividamento,
  diversificacao,
  estabilidadeFluxo,
  dependenciaRenda,
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

  const getStatusDiversificacao = (valor: number): IndicadorSaude['status'] => {
    if (valor >= 70) return 'otimo';
    if (valor >= 50) return 'bom';
    if (valor >= 30) return 'atencao';
    return 'critico';
  };

  const getStatusEstabilidade = (valor: number): IndicadorSaude['status'] => {
    if (valor >= 80) return 'otimo';
    if (valor >= 60) return 'bom';
    if (valor >= 40) return 'atencao';
    return 'critico';
  };

  const getStatusDependencia = (valor: number): IndicadorSaude['status'] => {
    if (valor <= 40) return 'otimo';
    if (valor <= 60) return 'bom';
    if (valor <= 80) return 'atencao';
    return 'critico';
  };
  
  const getTooltipData = (id: string, status: IndicadorSaude['status'], valor: number) => {
    switch (id) {
        case 'liquidez': return {
            title: `Liquidez: ${valor.toFixed(2)}x`,
            text: "Capacidade de cobrir passivos com seus ativos atuais.",
            ideal: "> 2.0x"
        };
        case 'endividamento': return {
            title: `Endividamento: ${valor.toFixed(1)}%`,
            text: "Percentual do seu patrimônio comprometido com terceiros.",
            ideal: "< 20%"
        };
        default: return { title: 'Indicador', text: 'Análise de performance.', ideal: '-' };
    }
  };

  const indicadores = [
    { id: 'liquidez', nome: 'Liquidez Geral', valor: Math.min(liquidez * 50, 100), status: getStatusLiquidez(liquidez), icon: Wallet, valorBruto: liquidez },
    { id: 'endividamento', nome: 'Endividamento', valor: 100 - Math.min(endividamento, 100), status: getStatusEndividamento(endividamento), icon: Scale, valorBruto: endividamento },
    { id: 'diversificacao', nome: 'Diversificação', valor: diversificacao, status: getStatusDiversificacao(diversificacao), icon: TrendingUp, valorBruto: diversificacao },
    { id: 'estabilidade', nome: 'Estabilidade', valor: estabilidadeFluxo, status: getStatusEstabilidade(estabilidadeFluxo), icon: Activity, valorBruto: estabilidadeFluxo },
    { id: 'dependencia', nome: 'Comprometimento', valor: 100 - Math.min(dependenciaRenda, 100), status: getStatusDependencia(dependenciaRenda), icon: Briefcase, valorBruto: dependenciaRenda },
  ];

  const scoreGeral = indicadores.reduce((acc, ind) => acc + ind.valor, 0) / indicadores.length;
  const statusGeral = scoreGeral >= 75 ? 'otimo' : scoreGeral >= 55 ? 'bom' : scoreGeral >= 35 ? 'atencao' : 'critico';
  const configGeral = statusConfig[statusGeral];

  return (
    <TooltipProvider>
      <div className="glass-card p-6 rounded-[2.5rem] border-border/40 shadow-expressive">
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

        <div className="space-y-6">
          {indicadores.map((ind) => {
            const config = statusConfig[ind.status];
            const tooltip = getTooltipData(ind.id, ind.status, ind.valorBruto);
            
            return (
              <Tooltip key={ind.id}>
                <TooltipTrigger asChild>
                  <div className="space-y-2 cursor-help group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                          <ind.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="text-sm font-bold text-foreground">{ind.nome}</span>
                      </div>
                      <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-md", config.color, config.bgColor)}>
                        {config.label}
                      </span>
                    </div>
                    
                    <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 ease-out",
                          ind.status === 'otimo' && "bg-success",
                          ind.status === 'bom' && "bg-info",
                          ind.status === 'atencao' && "bg-warning",
                          ind.status === 'critico' && "bg-destructive",
                        )}
                        style={{ width: `${ind.valor}%` }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="p-3 bg-popover/95 border-border rounded-2xl shadow-2xl max-w-[200px]">
                  <p className="font-black text-xs mb-1">{tooltip.title}</p>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-tight">{tooltip.text}</p>
                  <div className="text-[9px] font-bold p-1 bg-muted rounded text-center">Referência: {tooltip.ideal}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}