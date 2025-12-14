import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertTriangle, Upload, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { useFinance, AmortizationItem } from "@/contexts/FinanceContext";
import { Emprestimo, TransacaoCompleta } from "@/types/finance";
import { cn, parseDateLocal } from "@/lib/utils";

interface Parcela extends AmortizationItem {
  dataVencimento: Date;
  valorTotal: number; // Valor da Parcela Fixa
  status: "pago" | "pendente" | "atrasado";
  dataPagamento?: string;
  valorPago?: number;
  diferencaJuros?: number; // Positivo se juros por atraso, negativo se desconto por adiantamento
  diasDiferenca?: number; // Dias de diferença entre pagamento e vencimento
}

interface InstallmentsTableProps {
  emprestimo: Emprestimo;
  className?: string;
}

// Função auxiliar para calcular a data de vencimento
const getDueDate = (startDateStr: string, installmentNumber: number): Date => {
  // Usa parseDateLocal para garantir que a data de início seja interpretada localmente
  const startDate = parseDateLocal(startDateStr);
  const dueDate = new Date(startDate);
  
  // Ajuste: Se installmentNumber = 1, adicionamos 0 meses.
  // Isso assume que dataInicio é a data de vencimento da primeira parcela.
  dueDate.setMonth(dueDate.getMonth() + installmentNumber - 1);
  
  return dueDate;
};

export function InstallmentsTable({ emprestimo, className }: InstallmentsTableProps) {
  const { transacoesV2, calculateLoanSchedule, calculatePaidInstallmentsUpToDate } = useFinance();
  
  // Buscar transações de pagamento vinculadas a este empréstimo
  const payments = useMemo(() => {
    return transacoesV2.filter(t => 
      t.operationType === 'pagamento_emprestimo' && 
      t.links?.loanId === `loan_${emprestimo.id}`
    );
  }, [transacoesV2, emprestimo.id]);

  const parcelas = useMemo<Parcela[]>(() => {
    if (!emprestimo.dataInicio || emprestimo.meses === 0) return [];

    const hoje = new Date();
    
    // 1. Obter o cronograma de amortização PRICE completo
    const schedule = calculateLoanSchedule(emprestimo.id);

    // 2. Mapear pagamentos por número de parcela
    const paymentsMap = new Map<number, TransacaoCompleta>();
    payments.forEach(p => {
      const parcelaNum = p.links?.parcelaId ? parseInt(p.links.parcelaId) : undefined;
      if (parcelaNum) {
        paymentsMap.set(parcelaNum, p);
      }
    });
    
    // 3. Construir a lista de parcelas com status e dados de pagamento
    const result: Parcela[] = schedule.map((item) => {
      const dataVencimento = getDueDate(emprestimo.dataInicio!, item.parcela);
      const payment = paymentsMap.get(item.parcela);
      
      let status: Parcela["status"] = "pendente";
      let dataPagamento: string | undefined;
      let valorPago: number | undefined;
      let diferencaJuros: number | undefined;
      let diasDiferenca: number | undefined;

      if (payment) {
        status = "pago";
        dataPagamento = payment.date;
        valorPago = payment.amount;
        
        const paymentDate = parseDateLocal(dataPagamento);
        const diffTime = paymentDate.getTime() - dataVencimento.getTime();
        diasDiferenca = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        // Diferença entre o valor pago e o valor da parcela fixa
        diferencaJuros = valorPago - emprestimo.parcela;
      } else {
        // Se não foi pago e a data de vencimento já passou
        if (dataVencimento < hoje) {
          status = "atrasado";
        }
      }
      
      return {
        ...item,
        dataVencimento,
        valorTotal: emprestimo.parcela,
        status,
        dataPagamento,
        valorPago,
        diferencaJuros,
        diasDiferenca,
      } as Parcela;
    });
    
    return result;
  }, [emprestimo, payments, calculateLoanSchedule]);

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const statusConfig = {
    pago: { icon: Check, color: "bg-success/10 text-success border-success/30", label: "Pago" },
    pendente: { icon: Clock, color: "bg-primary/10 text-primary border-primary/30", label: "Pendente" },
    atrasado: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive border-destructive/30", label: "Atrasado" },
  };

  const totalPago = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalParcelasPagas = parcelas.filter(p => p.status === 'pago').length;
  
  // Saldo Devedor Real (último saldo calculado)
  // Encontra a última parcela paga no cronograma
  const ultimaParcelaPaga = parcelas.filter(p => p.status === 'pago').pop();
  // O saldo devedor real é o saldo DEVEDOR da última parcela paga, ou o valor total se nenhuma foi paga.
  const saldoDevedorReal = ultimaParcelaPaga ? ultimaParcelaPaga.saldoDevedor : emprestimo.valorTotal;
  
  // Progresso Financeiro (Amortização Acumulada / Valor Total)
  const amortizacaoAcumulada = parcelas
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + p.amortizacao, 0);
    
  const progressoFinanceiro = emprestimo.valorTotal > 0 ? (amortizacaoAcumulada / emprestimo.valorTotal) * 100 : 0;

  return (
    <div className={cn("glass-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Controle de Parcelas</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="w-4 h-4 text-success" />
            {totalParcelasPagas} pagas
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-primary" />
            {emprestimo.meses - totalParcelasPagas} restantes
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
          <Table className="min-w-[1000px]"> {/* Aumentado min-width para 1000px */}
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground w-16">Nº</TableHead>
                <TableHead className="text-muted-foreground">Vencimento</TableHead>
                <TableHead className="text-muted-foreground">Pagamento</TableHead>
                <TableHead className="text-muted-foreground text-right">Valor Parcela</TableHead>
                <TableHead className="text-muted-foreground text-right">Juros</TableHead>
                <TableHead className="text-muted-foreground text-right">Amortização</TableHead>
                <TableHead className="text-muted-foreground text-right">Saldo Devedor</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Valor Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((parcela) => {
                const config = statusConfig[parcela.status];
                const StatusIcon = config.icon;
                const isPaid = parcela.status === 'pago';

                return (
                  <TableRow
                    key={parcela.parcela}
                    className={cn(
                      "border-border transition-colors",
                      isPaid ? "bg-success/5 hover:bg-success/10" : "hover:bg-muted/30",
                      parcela.status === 'atrasado' && "bg-destructive/5 hover:bg-destructive/10"
                    )}
                  >
                    <TableCell className="font-medium">{parcela.parcela}</TableCell>
                    <TableCell>{parcela.dataVencimento.toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className={cn(isPaid ? "text-success" : "text-muted-foreground")}>
                      {parcela.dataPagamento ? parseDateLocal(parcela.dataPagamento).toLocaleDateString("pt-BR") : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(emprestimo.parcela)}
                    </TableCell>
                    <TableCell className="text-right text-warning">
                      {formatCurrency(parcela.juros)}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {formatCurrency(parcela.amortizacao)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(parcela.saldoDevedor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("gap-1", config.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </TableCell> 
                    <TableCell className="text-center font-medium">
                      {isPaid ? formatCurrency(parcela.valorPago || emprestimo.parcela) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total Pago</p>
          <p className="text-lg font-bold text-success">
            {formatCurrency(totalPago)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Saldo Devedor</p>
          <p className="text-lg font-bold text-destructive">
            {formatCurrency(saldoDevedorReal)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Progresso Financeiro</p>
          <p className="text-lg font-bold text-primary">
            {progressoFinanceiro.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}