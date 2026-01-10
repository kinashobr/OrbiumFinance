import { 
  Landmark, 
  Bitcoin, 
  Coins, 
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AtivoGrupo {
  id: string;
  nome: string;
  valor: number;
  variacao: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface AcompanhamentoAtivosProps {
  investimentosRF: number;
  criptomoedas: number;
  stablecoins: number;
  reservaEmergencia: number;
  poupanca: number;
  variacaoRF?: number;
  variacaoCripto?: number;
}

export function AcompanhamentoAtivos({
  investimentosRF,
  criptomoedas,
  stablecoins,
  reservaEmergencia,
  poupanca,
  variacaoRF = 0,
  variacaoCripto = 0,
}: AcompanhamentoAtivosProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const formatCurrencySmall = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  const grupos: AtivoGrupo[] = [
    { id: 'rf', nome: 'Renda Fixa', valor: investimentosRF + poupanca, variacao: variacaoRF, icon: Landmark, color: 'text-info', bgColor: 'bg-info/15' },
    { id: 'cripto', nome: 'Criptoativos', valor: criptomoedas, variacao: variacaoCripto, icon: Bitcoin, color: 'text-warning', bgColor: 'bg-warning/15' },
    { id: 'stables', nome: 'Stablecoins', valor: stablecoins, variacao: 0, icon: Coins, color: 'text-success', bgColor: 'bg-success/15' },
    { id: 'reserva', nome: 'Reserva', valor: reservaEmergencia, variacao: 0, icon: PiggyBank, color: 'text-primary', bgColor: 'bg-primary/15' },
  ].filter(g => g.valor > 0);

  const totalAtivos = grupos.reduce((acc, g) => acc + g.valor, 0);
  
  // Simulação de Liquidez (76% do total)
  const liquidezPercent = 76;
  const liquidezValue = totalAtivos * (liquidezPercent / 100);
  
  // Simulação de Carteira (60% em RF)
  const carteiraPercent = 60;
  const carteiraValue = totalAtivos * (carteiraPercent / 100);
  
  // Função para calcular o offset do círculo
  const calculateCircleOffset = (percent: number) => {
    const circumference = 2 * Math.PI * 40; // Raio 40
    return circumference - (percent / 100) * circumference;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
      
      {/* Card 1: Liquidez Geral */}
      <Card className="col-span-1 bg-card rounded-[var(--radius)] p-5 shadow-soft border border-border/60 flex flex-col items-center justify-between text-center relative overflow-hidden h-52">
        <div className="w-full flex justify-between items-center mb-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Liquidez</p>
          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
        </div>
        <div className="relative w-24 h-24 flex items-center justify-center my-auto">
          <svg className="transform -rotate-90 w-full h-full">
            <circle className="text-muted/50" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
            <circle 
              className="text-primary transition-all duration-1000" 
              cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" 
              strokeDasharray="251.2" 
              strokeDashoffset={calculateCircleOffset(liquidezPercent)} 
              strokeLinecap="round" 
              strokeWidth="6"
            ></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold text-xl text-foreground">{liquidezPercent}%</span>
          </div>
        </div>
        <div className="w-full text-center">
          <p className="text-lg font-bold text-foreground leading-tight">{formatCurrencySmall(liquidezValue)}</p>
          <p className="text-[10px] text-muted-foreground">Disponível</p>
        </div>
      </Card>
      
      {/* Card 2: Carteira (Renda Fixa) */}
      <Card className="col-span-1 bg-card rounded-[var(--radius)] p-5 shadow-soft border border-border/60 flex flex-col items-center justify-between text-center relative overflow-hidden h-52">
        <div className="w-full flex justify-between items-center mb-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Carteira</p>
          <span className="w-1.5 h-1.5 bg-info rounded-full"></span>
        </div>
        <div className="relative w-24 h-24 flex items-center justify-center my-auto">
          <svg className="transform -rotate-90 w-full h-full">
            <circle className="text-muted/50" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
            <circle 
              className="text-info transition-all duration-1000" 
              cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" 
              strokeDasharray="251.2" 
              strokeDashoffset={calculateCircleOffset(carteiraPercent)} 
              strokeLinecap="round" 
              strokeWidth="6"
            ></circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold text-xl text-foreground">{carteiraPercent}%</span>
          </div>
        </div>
        <div className="w-full text-center">
          <p className="text-lg font-bold text-foreground leading-tight">{formatCurrencySmall(carteiraValue)}</p>
          <p className="text-[10px] text-muted-foreground">Renda Fixa</p>
        </div>
      </Card>
      
      {/* Lista de Ativos (Opcional, para detalhe) */}
      {grupos.length > 0 && (
        <div className="col-span-2 lg:col-span-1 space-y-3 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distribuição Detalhada</p>
          {grupos.map((grupo) => {
            const percentual = totalAtivos > 0 ? (grupo.valor / totalAtivos) * 100 : 0;
            return (
              <div key={grupo.id} className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", grupo.bgColor, grupo.color)}>
                  <grupo.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{grupo.nome}</p>
                  <Progress value={percentual} className="h-1.5 rounded-full mt-0.5" />
                </div>
                <span className="text-xs font-bold text-foreground tabular-nums">{percentual.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}