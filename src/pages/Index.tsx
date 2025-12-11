import { useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { CockpitCards } from "@/components/dashboard/CockpitCards";
import { MovimentacoesRelevantes } from "@/components/dashboard/MovimentacoesRelevantes";
import { AcompanhamentoAtivos } from "@/components/dashboard/AcompanhamentoAtivos";
import { SaudeFinanceira } from "@/components/dashboard/SaudeFinanceira";
import { FluxoCaixaHeatmap } from "@/components/dashboard/FluxoCaixaHeatmap";
import { 
  Activity,
  LayoutDashboard
} from "lucide-react";

const Index = () => {
  const { 
    transacoesV2,
    contasMovimento,
    emprestimos, 
    investimentosRF, 
    criptomoedas, 
    stablecoins, 
    objetivos,
  } = useFinance();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calcular saldo por conta
  const saldosPorConta = useMemo(() => {
    return contasMovimento.map(conta => {
      const contaTx = transacoesV2.filter(t => t.accountId === conta.id);
      const totalIn = contaTx.filter(t => t.flow === 'in' || t.flow === 'transfer_in').reduce((s, t) => s + t.amount, 0);
      const totalOut = contaTx.filter(t => t.flow === 'out' || t.flow === 'transfer_out').reduce((s, t) => s + t.amount, 0);
      return {
        ...conta,
        saldo: conta.initialBalance + totalIn - totalOut,
      };
    });
  }, [contasMovimento, transacoesV2]);

  // Liquidez imediata (contas correntes e poupança)
  const liquidezImediata = useMemo(() => {
    return saldosPorConta
      .filter(c => c.accountType === 'conta_corrente' || c.accountType === 'poupanca')
      .reduce((acc, c) => acc + c.saldo, 0);
  }, [saldosPorConta]);

  // Total de todos os ativos
  const totalAtivos = useMemo(() => {
    const saldoContas = saldosPorConta.reduce((acc, c) => acc + c.saldo, 0);
    const rf = investimentosRF.reduce((acc, inv) => acc + inv.valor, 0);
    const cripto = criptomoedas.reduce((acc, c) => acc + c.valorBRL, 0);
    const stable = stablecoins.reduce((acc, s) => acc + s.valorBRL, 0);
    const objs = objetivos.reduce((acc, o) => acc + o.atual, 0);
    return saldoContas + rf + cripto + stable + objs;
  }, [saldosPorConta, investimentosRF, criptomoedas, stablecoins, objetivos]);

  // Total dívidas (empréstimos ativos)
  const totalDividas = useMemo(() => {
    return emprestimos
      .filter(e => e.status !== 'pendente_config' && e.status !== 'quitado')
      .reduce((acc, e) => {
        const parcelasPagas = e.parcelasPagas || 0;
        const saldoDevedor = Math.max(0, e.valorTotal - (parcelasPagas * e.parcela));
        return acc + saldoDevedor;
      }, 0);
  }, [emprestimos]);

  // Patrimônio total
  const patrimonioTotal = totalAtivos - totalDividas;

  // Transações do mês atual
  const transacoesMesAtual = useMemo(() => {
    return transacoesV2.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [transacoesV2, currentMonth, currentYear]);

  // Transações do mês anterior
  const transacoesMesAnterior = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return transacoesV2.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });
  }, [transacoesV2, currentMonth, currentYear]);

  // Receitas e despesas do mês
  const receitasMes = useMemo(() => {
    return transacoesMesAtual
      .filter(t => t.operationType === 'receita' || t.operationType === 'rendimento')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transacoesMesAtual]);

  const despesasMes = useMemo(() => {
    return transacoesMesAtual
      .filter(t => t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transacoesMesAtual]);

  // Receitas e despesas do mês anterior
  const receitasMesAnterior = useMemo(() => {
    return transacoesMesAnterior
      .filter(t => t.operationType === 'receita' || t.operationType === 'rendimento')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transacoesMesAnterior]);

  const despesasMesAnterior = useMemo(() => {
    return transacoesMesAnterior
      .filter(t => t.operationType === 'despesa' || t.operationType === 'pagamento_emprestimo')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transacoesMesAnterior]);

  // Variação do patrimônio
  const saldoMesAtual = receitasMes - despesasMes;
  const saldoMesAnterior = receitasMesAnterior - despesasMesAnterior;
  const variacaoPatrimonio = saldoMesAtual - saldoMesAnterior;
  const variacaoPercentual = saldoMesAnterior !== 0 
    ? ((saldoMesAtual - saldoMesAnterior) / Math.abs(saldoMesAnterior)) * 100 
    : 0;

  // Compromissos do mês (despesas + parcelas empréstimo)
  const compromissosMes = despesasMes;

  // Projeção 30 dias (baseado na média)
  const projecao30Dias = saldoMesAtual;

  // Dados do cockpit
  const cockpitData = {
    patrimonioTotal,
    variacaoPatrimonio,
    variacaoPercentual,
    liquidezImediata,
    compromissosMes,
    projecao30Dias,
  };

  // Dados para acompanhamento de ativos
  const investimentosRFTotal = useMemo(() => {
    const rfLegado = investimentosRF.reduce((acc, inv) => acc + inv.valor, 0);
    const rfContas = saldosPorConta
      .filter(c => c.accountType === 'aplicacao_renda_fixa')
      .reduce((acc, c) => acc + c.saldo, 0);
    return rfLegado + rfContas;
  }, [investimentosRF, saldosPorConta]);

  const poupancaTotal = useMemo(() => {
    return saldosPorConta
      .filter(c => c.accountType === 'poupanca')
      .reduce((acc, c) => acc + c.saldo, 0);
  }, [saldosPorConta]);

  const reservaEmergencia = useMemo(() => {
    return saldosPorConta
      .filter(c => c.accountType === 'reserva_emergencia')
      .reduce((acc, c) => acc + c.saldo, 0);
  }, [saldosPorConta]);

  const criptoTotal = criptomoedas.reduce((acc, c) => acc + c.valorBRL, 0);
  const stablesTotal = stablecoins.reduce((acc, s) => acc + s.valorBRL, 0);

  // Dados para saúde financeira
  const liquidezRatio = totalDividas > 0 ? liquidezImediata / (totalDividas * 0.1 || 1) : 2;
  const endividamentoPercent = totalAtivos > 0 ? (totalDividas / totalAtivos) * 100 : 0;
  
  // Diversificação (quantos tipos de ativos diferentes > 0)
  const tiposAtivos = [
    investimentosRFTotal > 0,
    criptoTotal > 0,
    stablesTotal > 0,
    reservaEmergencia > 0,
    poupancaTotal > 0,
    liquidezImediata > 0,
  ].filter(Boolean).length;
  const diversificacaoPercent = (tiposAtivos / 6) * 100;

  // Estabilidade do fluxo (meses com saldo positivo)
  const mesesPositivos = useMemo(() => {
    const ultimos6Meses = [];
    for (let i = 0; i < 6; i++) {
      const m = currentMonth - i < 0 ? 12 + (currentMonth - i) : currentMonth - i;
      const y = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      const txMes = transacoesV2.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === m && d.getFullYear() === y;
      });
      const rec = txMes.filter(t => t.operationType === 'receita').reduce((a, t) => a + t.amount, 0);
      const desp = txMes.filter(t => t.operationType === 'despesa').reduce((a, t) => a + t.amount, 0);
      if (rec > desp) ultimos6Meses.push(true);
      else ultimos6Meses.push(false);
    }
    return (ultimos6Meses.filter(Boolean).length / 6) * 100;
  }, [transacoesV2, currentMonth, currentYear]);

  // Dependência de renda (assumindo 80% se não há dados)
  const dependenciaRenda = receitasMes > 0 ? 80 : 100;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="p-2 rounded-xl bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central Financeira</h1>
            <p className="text-sm text-muted-foreground">
              Visão rápida da sua situação financeira
            </p>
          </div>
        </div>

        {/* Bloco 1 - Cockpit */}
        <section className="animate-fade-in-up">
          <CockpitCards data={cockpitData} />
        </section>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna esquerda - Movimentações e Fluxo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bloco 3 - Movimentações Relevantes */}
            <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <MovimentacoesRelevantes transacoes={transacoesV2} limit={6} />
            </section>

            {/* Fluxo de Caixa Heatmap */}
            <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <FluxoCaixaHeatmap 
                month={String(currentMonth + 1).padStart(2, '0')} 
                year={currentYear} 
                transacoes={transacoesV2} 
              />
            </section>
          </div>

          {/* Coluna direita - Ativos e Saúde */}
          <div className="space-y-6">
            {/* Bloco 4 - Acompanhamento de Ativos */}
            <section className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <AcompanhamentoAtivos
                investimentosRF={investimentosRFTotal}
                criptomoedas={criptoTotal}
                stablecoins={stablesTotal}
                reservaEmergencia={reservaEmergencia}
                poupanca={poupancaTotal}
              />
            </section>

            {/* Bloco 6 - Saúde Financeira */}
            <section className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <SaudeFinanceira
                liquidez={liquidezRatio}
                endividamento={endividamentoPercent}
                diversificacao={diversificacaoPercent}
                estabilidadeFluxo={mesesPositivos}
                dependenciaRenda={dependenciaRenda}
              />
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
