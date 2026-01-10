import { useState, useMemo } from "react";
import { Calculator, TrendingUp, RefreshCw, DollarSign, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Emprestimo } from "@/types/finance";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";

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

  const simulacaoAumento = useMemo(() => {
    const aumento = Number(aumentoParcela) || 0;
    if (aumento <= 0 || totalSaldoDevedor <= 0) return null;
    const novaParcela = parcelaTotal + aumento;
    const i = taxaMedia / 100;
    let mesesRestantes = 0;
    let novosMesesRestantes = 0;
    if (i > 0 && parcelaTotal > 0 && novaParcela > 0) {
        const term1 = (totalSaldoDevedor * i) / parcelaTotal;
        mesesRestantes = term1 < 1 ? -Math.log(1 - term1) / Math.log(1 + i) : 999;
        const term2 = (totalSaldoDevedor * i) / novaParcela;
        novosMesesRestantes = term2 < 1 ? -Math.log(1 - term2) / Math.log(1 + i) : 999;
    } else if (i === 0) {
        mesesRestantes = totalSaldoDevedor / parcelaTotal;
        novosMesesRestantes = totalSaldoDevedor / novaParcela;
    } else return null;
    const mesesEconomizados = Math.max(0, mesesRestantes - novosMesesRestantes);
    const jurosEconomizadosFinal = Math.max(0, (parcelaTotal * mesesRestantes) - (novaParcela * novosMesesRestantes));
    return { novaParcela, mesesEconomizados, jurosEconomizados: jurosEconomizadosFinal };
  }, [aumentoParcela, parcelaTotal, totalSaldoDevedor, taxaMedia]);

  const simulacaoQuitacao = useMemo(() => {
    const valor = Number(valorQuitacao) || 0;
    if (valor <= 0 || totalSaldoDevedor <= 0) return null;
    const percentualQuitacao = Math.min(100, (valor / totalSaldoDevedor) * 100);
    const saldoRestante = Math.max(0, totalSaldoDevedor - valor);
    let jurosRestantesTotal = 0;
    emprestimos.forEach(e => {
        if (e.status === 'quitado' || e.status === 'pendente_config') return;
        const schedule = calculateLoanSchedule(e.id);
        const parcelasPagas = e.parcelasPagas || 0;
        jurosRestantesTotal += schedule.filter(item => item.parcela > parcelasPagas).reduce((acc, item) => acc + item.juros, 0);
    });
    const jurosEconomizados = jurosRestantesTotal * (valor / totalSaldoDevedor);
    return { percentualQuitacao, saldoRestante, jurosEconomizados: Math.max(0, jurosEconomizados) };
  }, [valorQuitacao, totalSaldoDevedor, calculateLoanSchedule, emprestimos]);

  const simulacaoRefinanciamento = useMemo(() => {
    const taxa = Number(novaTaxa) || 0;
    if (taxa <= 0 || taxa >= taxaMedia || totalSaldoDevedor <= 0) return null;
    const diferencaTaxa = taxaMedia - taxa;
    const economiaAnual = totalSaldoDevedor * (diferencaTaxa / 100) * 12;
    const mesesRestantes = totalSaldoDevedor / parcelaTotal; 
    const i = taxa / 100;
    let novaParcela = 0;
    if (i > 0 && mesesRestantes > 0) novaParcela = (totalSaldoDevedor * i) / (1 - Math.pow(1 + i, -mesesRestantes));
    else if (i === 0) novaParcela = totalSaldoDevedor / mesesRestantes;
    else return null;
    return { novaTaxa: taxa, economiaAnual, novaParcela, reducaoParcela: parcelaTotal - novaParcela };
  }, [novaTaxa, taxaMedia, totalSaldoDevedor, parcelaTotal]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Calculator className="w-5 h-5" />
        </div>
        <h3 className="font-display font-bold text-lg text-foreground">Simulador de Cenários</h3>
      </div>

      <Tabs defaultValue="aumentar" className="space-y-6">
        <TabsList className="bg-muted/50 w-full grid grid-cols-3 p-1 rounded-2xl h-12">
          <TabsTrigger value="aumentar" className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Aumentar
          </TabsTrigger>
          <TabsTrigger value="quitar" className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Quitar
          </TabsTrigger>
          <TabsTrigger value="refinanciar" className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Refinanciar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aumentar" className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Aumentar parcela em (R$)</Label>
            <Input
              type="number"
              placeholder="500"
              value={aumentoParcela}
              onChange={(e) => setAumentoParcela(e.target.value)}
              className="h-12 border-2 rounded-2xl bg-card font-bold text-lg"
            />
          </div>
          {simulacaoAumento && (
            <div className="p-6 rounded-[2rem] bg-success/5 border border-success/20 space-y-4 relative overflow-hidden">
              <Sparkles className="absolute -right-2 -top-2 w-12 h-12 text-success/10 rotate-12" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-success/60">Economia Estimada</span>
                <Badge className="bg-success/20 text-success border-none font-black text-[10px]">-{simulacaoAumento.mesesEconomizados.toFixed(0)} MESES</Badge>
              </div>
              <p className="text-3xl font-black text-success tracking-tighter">{formatCurrency(simulacaoAumento.jurosEconomizados)}</p>
              <div className="pt-3 border-t border-success/10 flex justify-between text-[10px] font-bold text-success/70 uppercase">
                <span>Nova Parcela</span>
                <span>{formatCurrency(simulacaoAumento.novaParcela)}</span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quitar" className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Valor para quitação (R$)</Label>
            <Input
              type="number"
              placeholder="10000"
              value={valorQuitacao}
              onChange={(e) => setValorQuitacao(e.target.value)}
              className="h-12 border-2 rounded-2xl bg-card font-bold text-lg"
            />
          </div>
          {simulacaoQuitacao && (
            <div className="p-6 rounded-[2rem] bg-success/5 border border-success/20 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-success/60">Juros que deixará de pagar</span>
                <Badge className="bg-success/20 text-success border-none font-black text-[10px]">{simulacaoQuitacao.percentualQuitacao.toFixed(0)}% DA DÍVIDA</Badge>
              </div>
              <p className="text-3xl font-black text-success tracking-tighter">{formatCurrency(simulacaoQuitacao.jurosEconomizados)}</p>
              <div className="pt-3 border-t border-success/10 flex justify-between text-[10px] font-bold text-success/70 uppercase">
                <span>Saldo Restante</span>
                <span>{formatCurrency(simulacaoQuitacao.saldoRestante)}</span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="refinanciar" className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Nova taxa mensal (%) - Atual: {taxaMedia.toFixed(2)}%</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="1.50"
              value={novaTaxa}
              onChange={(e) => setNovaTaxa(e.target.value)}
              className="h-12 border-2 rounded-2xl bg-card font-bold text-lg"
            />
          </div>
          {simulacaoRefinanciamento && (
            <div className="p-6 rounded-[2rem] bg-success/5 border border-success/20 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-success/60">Economia Anual</span>
                <Badge className="bg-success/20 text-success border-none font-black text-[10px]">-{formatCurrency(simulacaoRefinanciamento.reducaoParcela)}/MÊS</Badge>
              </div>
              <p className="text-3xl font-black text-success tracking-tighter">{formatCurrency(simulacaoRefinanciamento.economiaAnual)}</p>
              <div className="pt-3 border-t border-success/10 flex justify-between text-[10px] font-bold text-success/70 uppercase">
                <span>Nova Parcela</span>
                <span>{formatCurrency(simulacaoRefinanciamento.novaParcela)}</span>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}