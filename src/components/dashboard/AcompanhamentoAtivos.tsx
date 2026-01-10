import { 
  Landmark, 
  Bitcoin, 
  Coins, 
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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

  const grupos: AtivoGrupo[] = [
    { id: 'rf', nome: 'Renda Fixa', valor: investimentosRF + poupanca, variacao: variacaoRF, icon: Landmark, color: 'text-info', bgColor: 'bg-info/15' },
    { id: 'cripto', nome: 'Criptoativos', valor: criptomoedas, variacao: variacaoCripto, icon: Bitcoin, color: 'text-warning', bgColor: 'bg-warning/15' },
    { id: 'stables', nome: 'Stablecoins', valor: stablecoins, variacao: 0, icon: Coins, color: 'text-success', bgColor: 'bg-success/15' },
    { id: 'reserva', nome: 'Reserva', valor: reservaEmergencia, variacao: 0, icon: PiggyBank, color: 'text-primary', bgColor: 'bg-primary/15' },
  ].filter(g => g.valor > 0);

  const totalAtivos = grupos.reduce((acc, g) => acc + g.valor, 0);

  return (
    <div className="glass-card p-6 rounded-[2.5rem] border-border/40 shadow-expressive">
      <div className="mb-6">
        <h3 className="text-lg font-black text-foreground tracking-tight">Ativos Totais</h3>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Distribuição da Carteira</p>
      </div>

      <div className="space-y-6">
        {grupos.map((grupo) => {
          const percentual = totalAtivos > 0 ? (grupo.valor / totalAtivos) * 100 : 0;
          
          return (
            <div key={grupo.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-110", grupo.bgColor, grupo.color)}>
                    <grupo.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">{grupo.nome}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60">{percentual.toFixed(0)}% da carteira</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground tabular-nums">{formatCurrency(grupo.valor)}</p>
                  {grupo.variacao !== 0 && (
                    <div className={cn("flex items-center justify-end gap-1 text-[10px] font-black uppercase", grupo.variacao > 0 ? "text-success" : "text-destructive")}>
                        {grupo.variacao > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {Math.abs(grupo.variacao).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
              <Progress value={percentual} className="h-2 rounded-full" />
            </div>
          );
        })}

        <div className="pt-4 mt-6 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Total Investido</span>
            <span className="text-xl font-black text-primary tabular-nums">
              {formatCurrency(totalAtivos)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}