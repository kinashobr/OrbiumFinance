import { 
  Wallet, 
  Scale, 
  Activity,
  Shield,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SaudeFinanceiraProps {
  liquidez: number;
  endividamento: number;
  diversificacao: number;
  estabilidadeFluxo: number;
  dependenciaRenda: number;
}

// Define the structure for status objects
interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  badgeClass: string; // NOVO: Classe para o badge de status
}

const getLiquidezStatus = (val: number): StatusConfig => {
  if (val >= 2) return { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  if (val >= 1.2) return { label: "BOM", color: "text-blue-800", bg: "bg-blue-50/80 dark:bg-blue-900/10", border: "border-blue-100 dark:border-blue-900/20", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" };
  return { label: "ATENÇÃO", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" };
};

const getEndividamentoStatus = (val: number): StatusConfig => {
  if (val <= 25) return { label: "ÓTIMO", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  if (val <= 45) return { label: "ALERTA", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" };
  return { label: "ALTO", color: "text-red-800", bg: "bg-red-50/80 dark:bg-red-900/10", border: "border-red-100 dark:border-red-900/20", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" };
};

const getDiversificacaoStatus = (val: number): StatusConfig => {
  if (val >= 60) return { label: "ALTA", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
  return { label: "BAIXA", color: "text-orange-800", bg: "bg-orange-50/80 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" };
};

const getEstabilidadeStatus = (val: number): StatusConfig => {
    if (val >= 80) return { label: "ALTA", color: "text-green-800", bg: "bg-green-50/80 dark:bg-green-900/10", border: "border-green-100 dark:border-green-900/20", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" };
    return { label: "MÉDIA", color: "text-primary", bg: "bg-primary/5 dark:bg-primary/10", border: "border-primary/20 dark:border-primary/30", badgeClass: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary" };
};


export function SaudeFinanceira({
  liquidez,
  endividamento,
  diversificacao,
  estabilidadeFluxo,
  dependenciaRenda,
}: SaudeFinanceiraProps) {
  
  const liq = getLiquidezStatus(liquidez);
  const end = getEndividamentoStatus(endividamento);
  const div = getDiversificacaoStatus(diversificacao);
  const est = getEstabilidadeStatus(estabilidadeFluxo); // NEW

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-display font-bold text-lg text-foreground">Indicadores de Saúde</h3>
          <span className="text-[10px] font-bold text-primary bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-full uppercase tracking-wide">Desempenho</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Liquidez */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", liq.bg, liq.border)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Wallet className={cn("w-5 h-5", liq.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", liq.badgeClass)}>
                    {liq.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", liq.color.replace('800', '600'))}>{liquidez.toFixed(1)}x</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Folga Financeira</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] p-3 rounded-2xl">
              <p className="text-xs font-bold mb-1">O que é:</p>
              <p className="text-xs text-muted-foreground mb-2">Quantas vezes seu patrimônio cobre suas dívidas.</p>
              <p className="text-xs font-bold mb-1">Como é calculado:</p>
              <p className="text-xs text-muted-foreground mb-2">Bens ÷ Dívidas</p>
              <p className="text-xs font-bold mb-1">Faixa ideal:</p>
              <p className="text-xs text-muted-foreground">Acima de 1.5 é saudável</p>
            </TooltipContent>
          </Tooltip>

          {/* Endividamento */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", end.bg, end.border)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Scale className={cn("w-5 h-5", end.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", end.badgeClass)}>
                    {end.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", end.color.replace('800', '600'))}>{endividamento.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Nível de Dívidas</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] p-3 rounded-2xl">
              <p className="text-xs font-bold mb-1">O que é:</p>
              <p className="text-xs text-muted-foreground mb-2">Quanto do seu patrimônio está comprometido com dívidas.</p>
              <p className="text-xs font-bold mb-1">Como é calculado:</p>
              <p className="text-xs text-muted-foreground mb-2">(Dívidas ÷ Bens) × 100</p>
              <p className="text-xs font-bold mb-1">Faixa ideal:</p>
              <p className="text-xs text-muted-foreground">Abaixo de 30%</p>
            </TooltipContent>
          </Tooltip>

          {/* Diversificação */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", div.bg, "border-neutral-100 dark:border-neutral-800")}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Activity className={cn("w-5 h-5", div.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", div.badgeClass)}>
                    {div.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold", div.color.replace('800', '600'))}>{diversificacao.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">Variedade de Ativos</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] p-3 rounded-2xl">
              <p className="text-xs font-bold mb-1">O que é:</p>
              <p className="text-xs text-muted-foreground mb-2">Equilíbrio entre diferentes tipos de investimento.</p>
              <p className="text-xs font-bold mb-1">Para que serve:</p>
              <p className="text-xs text-muted-foreground mb-2">Quanto mais diversificado, menor o risco da sua carteira.</p>
              <p className="text-xs font-bold mb-1">Faixa ideal:</p>
              <p className="text-xs text-muted-foreground">Acima de 60%</p>
            </TooltipContent>
          </Tooltip>

          {/* Estabilidade Fluxo - FIXADO */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("rounded-3xl p-5 border transition-all hover:scale-[1.02] group relative overflow-hidden cursor-help", est.bg, est.border)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-black/20 flex items-center justify-center shadow-sm">
                    <Shield className={cn("w-5 h-5", est.color)} />
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5", est.badgeClass)}>
                    {est.label}
                  </span>
                </div>
                <p className={cn("text-3xl font-display font-bold text-foreground", est.color.replace('800', '600'))}>{estabilidadeFluxo.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Consistência</p>
                  <Info className="w-2.5 h-2.5 opacity-40" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] p-3 rounded-2xl">
              <p className="text-xs font-bold mb-1">O que é:</p>
              <p className="text-xs text-muted-foreground mb-2">Regularidade das suas sobras de caixa mensais.</p>
              <p className="text-xs font-bold mb-1">Para que serve:</p>
              <p className="text-xs text-muted-foreground mb-2">Mostra se você consegue manter uma rotina de economia.</p>
              <p className="text-xs font-bold mb-1">Faixa ideal:</p>
              <p className="text-xs text-muted-foreground">Acima de 80%</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}