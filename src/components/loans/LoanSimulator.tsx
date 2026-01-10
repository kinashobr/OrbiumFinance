import { useState, useMemo } from "react";
import { Calculator, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Emprestimo } from "@/types/finance";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { Badge } from "@/components/ui/badge";

interface LoanSimulatorProps {
  emprestimos: Emprestimo[];
  className?: string;
}

export function LoanSimulator({ emprestimos, className }: LoanSimulatorProps) {
  const { calculateLoanSchedule } = useFinance();
  
  const [aumentoParcela, setAumentoParcela] = useState("");
  const [valorQuitacao, setValorQuitacao] = useState("");
  const [novaTaxa, setNovaTaxa] = useState("");

  const totalSaldoDevedor = useMemo(() => {
    return emprestimos.reduce((acc, e) => {
      if (e.status === 'quitado' || e.status === 'pendente_config') return acc;
      const schedule = calculateLoanSchedule(e.id);
      const parcelasPagas = e.parcelasPagas || 0; 
      let saldoDevedor = e.valorTotal;
      if (parcelasPagas > 0) {
          const ultimaParcelaPaga = schedule.find(item => item.parcela === parcelasPagas);
          if (ultimaParcelaPaga) saldoDevedor = ultimaParcelaPaga.saldoDevedor;
      }
      return acc + saldoDevedor;
    }, 0);
  }, [emprestimos, calculateLoanSchedule]);

  const parcelaTotal = useMemo(() => emprestimos.reduce((acc, e) => acc + e.parcela, 0), [emprestimos]);

  const taxaMedia = useMemo(() => {
    if (emprestimos.length === 0) return 0;
    const totalPrincipal = emprestimos.reduce((acc, e) => acc + e.valorTotal, 0);
    if (totalPrincipal === 0) return 0;
    const taxaPonderada = emprestimos.reduce((acc, e) => acc + (e.taxaMensal * e.valorTotal), 0);
    return taxaPonderada / totalPrincipal;
  }, [emprestimos]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const ResultCard = ({ title, value, badge, subtext, labelSub }: { title: string, value: string, badge?: string, subtext?: string, labelSub?: string }) => (
    <div className="p-8 rounded-[2.5rem] bg-success/5 border border-success/20 space-y-4 relative overflow-hidden animate-in zoom-in duration-500">
        <Sparkles className="absolute -right-4 -top-4 w-20 h-20 text-success/10 rotate-12" />
        <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-success/60">{title}</span>
            {badge && <Badge className="bg-success/20 text-success border-none font-black text-[10px] px-2 py-1">{badge}</Badge>}
        </div>
        <p className="text-5xl font-black text-success tracking-tighter tabular-nums">{value}</p>
        <div className="pt-4 border-t border-success/10 flex justify-between items-end">
            <div className="space-y-1">
                <p className="text-[9px] font-black text-success/50 uppercase tracking-widest">{labelSub}</p>
                <p className="text-sm font-black text-success/80 uppercase">{subtext}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-success/30" />
        </div>
    </div>
  );

  const simulacaoAumento = useMemo(() => {
    const aumento = Number(aumentoParcela) || 0;
    if (aumento <= 0 || totalSaldoDevedor <= 0) return null;
    const novaParcela = parcelaTotal + aumento;
    const i = taxaMedia / 100;
    let mesesRestantes = 0, novosMesesRestantes = 0;
    if (i > 0 && parcelaTotal > 0 && novaParcela > 0) {
        const term1 = (totalSaldoDevedor * i) / parcelaTotal;
        mesesRestantes = term1 < 1 ? -Math.log(1 - term1) / Math.log(1 + i) : 999;
        const term2 = (totalSaldoDevedor * i) / novaParcela;
        novosMesesRestantes = term2 < 1 ? -Math.log(1 - term2) / Math.log(1 + i) : 999;
    } else if (i === 0) {
        mesesRestantes = totalSaldoDevedor / parcelaTotal;
        novosMesesRestantes = totalSaldoDevedor / novaParcela;
    }
    return { novaParcela, mesesEconomizados: Math.max(0, mesesRestantes - novosMesesRestantes), jurosEconomizados: Math.max(0, (parcelaTotal * mesesRestantes) - (novaParcela * novosMesesRestantes)) };
  }, [aumentoParcela, parcelaTotal, totalSaldoDevedor, taxaMedia]);

  const simulacaoQuitacao = useMemo(() => {
    const valor = Number(valorQuitacao) || 0;
    if (valor <= 0 || totalSaldoDevedor <= 0) return null;
    let jurosRestantesTotal = 0;
    emprestimos.forEach(e => {
        if (e.status === 'quitado' || e.status === 'pendente_config') return;
        const schedule = calculateLoanSchedule(e.id);
        const parcelasPagas = e.parcelasPagas || 0;
        jurosRestantesTotal += schedule.filter(item => item.parcela > parcelasPagas).reduce((acc, item) => acc + item.juros, 0);
    });
    return { percentualQuitacao: Math.min(100, (valor / totalSaldoDevedor) * 100), saldoRestante: Math.max(0, totalSaldoDevedor - valor), jurosEconomizados: Math.max(0, jurosRestantesTotal * (valor / totalSaldoDevedor)) };
  }, [valorQuitacao, totalSaldoDevedor, calculateLoanSchedule, emprestimos]);

  const simulacaoRefinanciamento = useMemo(() => {
    const taxa = Number(novaTaxa) || 0;
    if (taxa <= 0 || taxa >= taxaMedia || totalSaldoDevedor <= 0) return null;
    const i = taxa / 100;
    const mesesRestantes = totalSaldoDevedor / (parcelaTotal || 1); 
    const novaParcela = i > 0 ? (totalSaldoDevedor * i) / (1 - Math.pow(1 + i, -mesesRestantes)) : totalSaldoDevedor / mesesRestantes;
    return { economiaAnual: totalSaldoDevedor * ((taxaMedia - taxa) / 100) * 12, novaParcela };
  }, [novaTaxa, taxaMedia, totalSaldoDevedor, parcelaTotal]);

  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-primary/10 rounded-2xl text-primary shadow-sm">
          <Calculator className="w-6 h-6" />
        </div>
        <h3 className="font-display font-bold text-xl text-foreground">Laboratório de Crédito</h3>
      </div>

      <Tabs defaultValue="aumentar" className="space-y-8">
        <TabsList className="bg-muted/50 w-full grid grid-cols-3 p-1.5 rounded-[2rem] h-14">
          <TabsTrigger value="aumentar" className="rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-md">Aumentar</TabsTrigger>
          <TabsTrigger value="quitar" className="rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-md">Quitar</TabsTrigger>
          <TabsTrigger value="refinanciar" className="rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-md">Refinanciar</TabsTrigger>
        </TabsList>

        <TabsContent value="aumentar" className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Aporte Extra Mensal (R$)</Label>
            <Input type="number" placeholder="Ex: 500" value={aumentoParcela} onChange={(e) => setAumentoParcela(e.target.value)} className="h-14 border-2 rounded-2xl bg-card font-black text-2xl px-6" />
          </div>
          {simulacaoAumento && (
            <ResultCard 
                title="Redução Projetada" 
                value={`R$ ${simulacaoAumento.jurosEconomizados.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} 
                badge={`-${simulacaoAumento.mesesEconomizados.toFixed(0)} MESES`}
                labelSub="Nova Parcela"
                subtext={formatCurrency(simulacaoAumento.novaParcela)}
            />
          )}
        </TabsContent>

        <TabsContent value="quitar" className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Valor para Amortização (R$)</Label>
            <Input type="number" placeholder="Ex: 10.000" value={valorQuitacao} onChange={(e) => setValorQuitacao(e.target.value)} className="h-14 border-2 rounded-2xl bg-card font-black text-2xl px-6" />
          </div>
          {simulacaoQuitacao && (
            <ResultCard 
                title="Corte de Juros" 
                value={`R$ ${simulacaoQuitacao.jurosEconomizados.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} 
                badge={`${simulacaoQuitacao.percentualQuitacao.toFixed(0)}% DA DÍVIDA`}
                labelSub="Saldo Restante"
                subtext={formatCurrency(simulacaoQuitacao.saldoRestante)}
            />
          )}
        </TabsContent>

        <TabsContent value="refinanciar" className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Meta de Taxa Mensal (%)</Label>
            <Input type="number" step="0.01" placeholder={`Atual: ${taxaMedia.toFixed(2)}%`} value={novaTaxa} onChange={(e) => setNovaTaxa(e.target.value)} className="h-14 border-2 rounded-2xl bg-card font-black text-2xl px-6" />
          </div>
          {simulacaoRefinanciamento && (
            <ResultCard 
                title="Economia Anual" 
                value={`R$ ${simulacaoRefinanciamento.economiaAnual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} 
                badge="REFINANCIAMENTO"
                labelSub="Nova Parcela Estimada"
                subtext={formatCurrency(simulacaoRefinanciamento.novaParcela)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}