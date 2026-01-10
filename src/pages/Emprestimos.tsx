"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  CreditCard, 
  TrendingDown, 
  Building2, 
  Wallet, 
  Sparkles,
  LayoutGrid,
  ArrowRight,
  Info
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Emprestimo, ComparisonDateRanges } from "@/types/finance";
import { LoanForm } from "@/components/loans/LoanForm";
import { LoanAlerts } from "@/components/loans/LoanAlerts";
import { LoanCharts } from "@/components/loans/LoanCharts";
import { LoanDetailDialog } from "@/components/loans/LoanDetailDialog";
import { LoanSimulator } from "@/components/loans/LoanSimulator";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Emprestimos = () => {
  const { 
    emprestimos, 
    addEmprestimo, 
    getPendingLoans,
    getContasCorrentesTipo,
    dateRanges,
    setDateRanges,
    getLoanPrincipalRemaining,
    getCreditCardDebt,
    calculatePaidInstallmentsUpToDate,
  } = useFinance();
  
  const location = useLocation();
  const [selectedLoan, setSelectedLoan] = useState<Emprestimo | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const autoOpenHandledRef = useRef(false);
  
  const handlePeriodChange = useCallback((ranges: ComparisonDateRanges) => {
    setDateRanges(ranges);
  }, [setDateRanges]);

  const pendingLoans = getPendingLoans(); 

  useEffect(() => {
    const state = location.state as { openLoanConfig?: boolean } | null;
    if (state?.openLoanConfig && pendingLoans.length > 0 && !autoOpenHandledRef.current) {
      autoOpenHandledRef.current = true;
      setSelectedLoan(pendingLoans[0]);
      setDetailDialogOpen(true);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.state, pendingLoans, location.pathname]);

  const calculos = useMemo(() => {
    const targetDate = dateRanges.range1.to;
    return {
      saldoDevedorTotal: getLoanPrincipalRemaining(targetDate),
      dividaCartoes: getCreditCardDebt(targetDate),
      parcelaMensalTotal: emprestimos.reduce((acc, e) => acc + e.parcela, 0),
      jurosTotais: emprestimos.reduce((acc, e) => acc + (e.parcela * e.meses - e.valorTotal), 0),
    };
  }, [emprestimos, getLoanPrincipalRemaining, getCreditCardDebt, dateRanges.range1.to]);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="space-y-8 pb-10">
          {/* Header Expressivo */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-destructive to-red-700 flex items-center justify-center text-white shadow-lg shadow-destructive/20 ring-4 ring-destructive/10">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl leading-none tracking-tight">Financiamentos</h1>
                <p className="text-xs text-muted-foreground font-medium tracking-wide mt-0.5 uppercase">Gestão de Passivos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector 
                initialRanges={dateRanges}
                onDateRangeChange={handlePeriodChange}
                className="h-10 rounded-full bg-surface-light dark:bg-surface-dark border-border/40 shadow-sm"
              />
              {/* Botão Novo Empréstimo oculto */}
              {/* <LoanForm 
                onSubmit={addEmprestimo} 
                contasCorrentes={getContasCorrentesTipo()} 
                className="h-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 px-6 font-bold"
              /> */}
            </div>
          </header>

          {/* Cockpit de Passivos */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in-up">
            <div className="col-span-12 lg:col-span-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-8 shadow-soft relative overflow-hidden border border-white/60 dark:border-white/5 group h-[320px] flex flex-col justify-center cursor-help">
                    <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent opacity-50"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-destructive">
                          <TrendingDown className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Saldo Devedor Total</span>
                          <Info className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      </div>
                      <h2 className="font-display font-extrabold text-5xl sm:text-6xl text-foreground tracking-tight leading-none mt-4 tabular-nums">
                        {formatCurrency(calculos.saldoDevedorTotal)}
                      </h2>
                      <p className="text-muted-foreground font-medium mt-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                        Comprometimento passivo atual
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] p-4 rounded-3xl border-border shadow-2xl">
                  <p className="text-xs font-bold text-foreground mb-1">O que é este valor?</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Soma do principal restante de todos os seus empréstimos ativos. Não inclui juros futuros, apenas o que você deve hoje.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
              <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Parcela Mensal</p>
                  <p className="font-display font-bold text-3xl text-foreground">{formatCurrency(calculos.parcelaMensalTotal)}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Impacto na Renda</span>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-none font-black">ALERTA</Badge>
                  </div>
                </div>
              </div>

              <div className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cartão de Crédito</p>
                  <p className="font-display font-bold text-3xl text-foreground">{formatCurrency(calculos.dividaCartoes)}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Faturas em aberto</p>
                </div>
              </div>
            </div>
          </div>

          {/* Insights e Simulador */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <LoanAlerts emprestimos={emprestimos} onOpenPendingConfig={() => { setSelectedLoan(pendingLoans[0]); setDetailDialogOpen(true); }} />
              </section>
              
              <section className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="bg-surface-light dark:bg-surface-dark rounded-[40px] p-8 shadow-soft border border-white/60 dark:border-white/5">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="font-display font-bold text-xl text-foreground">Análise de Evolução</h3>
                  </div>
                  <LoanCharts emprestimos={emprestimos.filter(e => e.status !== 'pendente_config')} />
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <LoanSimulator emprestimos={emprestimos.filter(e => e.status !== 'pendente_config')} className="bg-surface-light dark:bg-surface-dark rounded-[32px] p-6 shadow-soft border border-white/60 dark:border-white/5" />
              </section>
            </div>
          </div>

          {/* Lista de Contratos em Cards */}
          <section className="space-y-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground">Contratos Ativos</h3>
              </div>
              <Badge variant="secondary" className="rounded-full px-4 py-1 font-bold">{emprestimos.length} Contratos</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {emprestimos.map((loan) => {
                const paidCount = calculatePaidInstallmentsUpToDate(loan.id, dateRanges.range1.to || new Date());
                const progress = (paidCount / loan.meses) * 100;
                
                return (
                  <div 
                    key={loan.id}
                    onClick={() => { setSelectedLoan(loan); setDetailDialogOpen(true); }}
                    className="bg-card hover:bg-muted/30 transition-all duration-300 rounded-[2.5rem] p-6 border border-border/40 shadow-sm hover:shadow-md group cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-base text-foreground leading-tight">{loan.contrato}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                            {loan.meses} meses • {loan.taxaMensal}% am
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Parcela</p>
                        <p className="font-black text-lg text-foreground">{formatCurrency(loan.parcela)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Progresso de Quitação</span>
                        <span className="text-xs font-black text-primary">{paidCount}/{loan.meses}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-primary transition-all duration-1000 ease-out" 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                      <Badge variant="outline" className={cn(
                        "border-none font-black text-[9px] px-2 py-1 rounded-lg",
                        loan.status === 'ativo' ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      )}>
                        {loan.status === 'ativo' ? 'EM DIA' : 'PENDENTE'}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary group-hover:translate-x-1 transition-transform">
                        DETALHES <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </TooltipProvider>

      <LoanDetailDialog emprestimo={selectedLoan} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} />
    </MainLayout>
  );
};

export default Emprestimos;