import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Wallet,
  Scale,
  Activity,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IndicadorSaude {
  id: string;
  nome: string;
  valor: number;
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  descricao: string;
}

interface SaudeFinanceiraProps {
  liquidez: number; // Liquidez Geral (Ativo Total / Passivo Total)
  endividamento: number; // percentual (Passivo Total / Ativo Total)
  diversificacao: number; // percentual (0-100, quanto mais diversificado melhor)
  estabilidadeFluxo: number; // percentual de meses positivos
  dependenciaRenda: number; // Comprometimento Fixo (Despesas Fixas / Receitas Totais)
}

const statusConfig = {
  otimo: { color: 'text-success', bgColor: 'bg-success/20', icon: CheckCircle2, label: 'Ótimo' },
  bom: { color: 'text-info', bgColor: 'bg-info/20', icon: Shield, label: 'Bom' },
  atencao: { color: 'text-warning', bgColor: 'bg-warning/20', icon: AlertTriangle, label: 'Atenção' },
  critico: { color: 'text-destructive', bgColor: 'bg-destructive/20', icon: XCircle, label: 'Crítico' },
};

export function SaudeFinanceira({
  liquidez,
  endividamento,
  diversificacao,
  estabilidadeFluxo,
  dependenciaRenda,
}: SaudeFinanceiraProps) {
  
  const getStatusLiquidez = (valor: number): IndicadorSaude['status'] => {
    // Liquidez Geral (Ativo Total / Passivo Total)
    if (valor >= 2.0) return 'otimo';
    if (valor >= 1.5) return 'bom';
    if (valor >= 1.0) return 'atencao';
    return 'critico';
  };

  const getStatusEndividamento = (valor: number): IndicadorSaude['status'] => {
    // Endividamento (Passivo Total / Ativo Total * 100)
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
    // Comprometimento Fixo (Despesas Fixas / Receitas Totais * 100)
    if (valor <= 40) return 'otimo';
    if (valor <= 60) return 'bom';
    if (valor <= 80) return 'atencao';
    return 'critico';
  };

  const indicadores: (IndicadorSaude & { icon: React.ElementType })[] = [
    {
      id: 'liquidez',
      nome: 'Liquidez Geral',
      valor: Math.min(liquidez * 50, 100), // normalizar para 0-100 (assumindo 2.0 = 100%)
      status: getStatusLiquidez(liquidez),
      descricao: liquidez >= 1.5 ? 'Ativos cobrem passivos adequadamente' : 'Atenção à cobertura de dívidas',
      icon: Wallet,
    },
    {
      id: 'endividamento',
      nome: 'Endividamento',
      valor: 100 - Math.min(endividamento, 100), // inverter (menos dívida = melhor)
      status: getStatusEndividamento(endividamento),
      descricao: endividamento <= 35 ? 'Dívidas sob controle' : 'Dívidas elevadas',
      icon: Scale,
    },
    {
      id: 'diversificacao',
      nome: 'Diversificação',
      valor: diversificacao,
      status: getStatusDiversificacao(diversificacao),
      descricao: diversificacao >= 50 ? 'Carteira diversificada' : 'Concentração elevada',
      icon: TrendingUp,
    },
    {
      id: 'estabilidade',
      nome: 'Estabilidade Fluxo',
      valor: estabilidadeFluxo,
      status: getStatusEstabilidade(estabilidadeFluxo),
      descricao: estabilidadeFluxo >= 60 ? 'Fluxo mensal estável' : 'Fluxo instável',
      icon: Activity,
    },
    {
      id: 'dependencia',
      nome: 'Comprometimento Fixo',
      valor: 100 - Math.min(dependenciaRenda, 100), // inverter (menos % fixo = melhor)
      status: getStatusDependencia(dependenciaRenda),
      descricao: dependenciaRenda <= 60 ? 'Custos fixos sob controle' : 'Alta rigidez orçamentária',
      icon: Briefcase,
    },
  ];

  // Calcular score geral
  const scoreGeral = indicadores.reduce((acc, ind) => acc + ind.valor, 0) / indicadores.length;
  const statusGeral = scoreGeral >= 75 ? 'otimo' : scoreGeral >= 55 ? 'bom' : scoreGeral >= 35 ? 'atencao' : 'critico';
  const configGeral = statusConfig[statusGeral];
  const IconGeral = configGeral.icon;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Saúde Financeira</h3>
          <p className="text-xs text-muted-foreground">Indicadores sintéticos</p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full", configGeral.bgColor)}>
          <IconGeral className={cn("h-3.5 w-3.5", configGeral.color)} />
          <span className={cn("text-xs font-semibold", configGeral.color)}>
            {configGeral.label}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {indicadores.map((ind) => {
          const config = statusConfig[ind.status];
          
          return (
            <div key={ind.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ind.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{ind.nome}</span>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  config.bgColor,
                  config.color
                )}>
                  {config.label}
                </div>
              </div>
              
              {/* Barra de progresso visual */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      ind.status === 'otimo' && "bg-success",
                      ind.status === 'bom' && "bg-info",
                      ind.status === 'atencao' && "bg-warning",
                      ind.status === 'critico' && "bg-destructive",
                    )}
                    style={{ width: `${ind.valor}%` }}
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">{ind.descricao}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}