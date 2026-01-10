import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, TrendingDown, Eye, Building2, Wallet } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Emprestimo } from "@/types/finance";
import { LoanCard } from "@/components/loans/LoanCard";
import { LoanForm } from "@/components/loans/LoanForm";
import { LoanAlerts } from "@/components/loans/LoanAlerts";
import { LoanCharts } from "@/components/loans/LoanCharts";
import { LoanDetailDialog } from "@/components/loans/LoanDetailDialog";
import { LoanSimulator } from "@/components/loans/LoanSimulator";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ComparisonDateRanges } from "@/types/finance";
import { parseDateLocal } from "@/lib/utils";
import { useLocation } from "react-router-dom";

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
      <div className="space-y-6">
        <header className="space-y-3 animate-fade-in border-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="inline-flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Passivos e Financiamentos</span>
                <span className="text-[11px]">Gestão de Dívidas</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 max-w-full">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={handlePeriodChange}
              className="h-8 rounded-full border-none bg-card px-3 text-[11px] font-medium text-secondary shadow-xs"
            />
            <LoanForm 
              onSubmit={addEmprestimo} 
              contasCorrentes={getContasCorrentesTipo()} 
              className="h-8 rounded-full bg-primary/10 text-primary border-none shadow-xs hover:bg-primary/20"
            />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoanCard title="Saldo Principal" value={formatCurrency(calculos.saldoDevedorTotal)} status="danger" icon={<TrendingDown className="w-5 h-5" />} delay={0} />
          <LoanCard title="Parcela Total" value={formatCurrency(calculos.parcelaMensalTotal)} status="warning" icon={<CreditCard className="w-5 h-5" />} delay={50} />
          <LoanCard title="Cartão Crédito" value={formatCurrency(calculos.dividaCartoes)} status="info" icon={<Wallet className="w-5 h-5" />} delay={100} />
          <LoanCard title="Juros Contrato" value={formatCurrency(calculos.jurosTotais)} status="warning" icon={<Building2 className="w-5 h-5" />} delay={150} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <LoanAlerts emprestimos={emprestimos} onOpenPendingConfig={() => { setSelectedLoan(pendingLoans[0]); setDetailDialogOpen(true); }} />
            <LoanCharts emprestimos={emprestimos.filter(e => e.status !== 'pendente_config')} />
          </div>
          <LoanSimulator emprestimos={emprestimos.filter(e => e.status !== 'pendente_config')} className="bg-secondary-container/30 border-secondary/20" />
        </div>

        <div className="glass-card p-5 rounded-[1.75rem] border-border/40">
          <h3 className="text-base font-bold text-foreground mb-4">Contratos Ativos</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase font-bold text-muted-foreground">Instituição</TableHead>
                  <TableHead className="text-[11px] uppercase font-bold text-muted-foreground">Parcela</TableHead>
                  <TableHead className="text-[11px] uppercase font-bold text-muted-foreground">Progresso</TableHead>
                  <TableHead className="text-[11px] uppercase font-bold text-muted-foreground text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emprestimos.map((loan) => {
                  const paidCount = calculatePaidInstallmentsUpToDate(loan.id, dateRanges.range1.to || new Date());
                  return (
                    <TableRow key={loan.id} className="border-none hover:bg-muted/30 transition-colors odd:bg-muted/10">
                      <TableCell className="py-4">
                        <p className="font-bold text-sm text-foreground">{loan.contrato}</p>
                        <p className="text-[10px] text-muted-foreground">{loan.meses} meses • {loan.taxaMensal}% am</p>
                      </TableCell>
                      <TableCell className="font-black text-sm">{formatCurrency(loan.parcela)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-20">
                            <div className="h-full bg-primary" style={{ width: `${(paidCount/loan.meses)*100}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground">{paidCount}/{loan.meses}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedLoan(loan); setDetailDialogOpen(true); }} className="w-8 h-8 rounded-full bg-primary/10 text-primary">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <LoanDetailDialog emprestimo={selectedLoan} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} />
    </MainLayout>
  );
};

export default Emprestimos;