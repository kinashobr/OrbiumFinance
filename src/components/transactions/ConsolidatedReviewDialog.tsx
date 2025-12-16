import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Check, Loader2, AlertCircle, Calendar, ArrowRight, X } from "lucide-react";
import { 
  ContaCorrente, Categoria, ImportedTransaction, StandardizationRule, 
  TransacaoCompleta, TransferGroup, generateTransactionId, generateTransferGroupId, 
  getDomainFromOperation, getFlowTypeFromOperation, DateRange, ComparisonDateRanges
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";
import { TransactionReviewTable } from "./TransactionReviewTable";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { PeriodSelector } from "../dashboard/PeriodSelector";
import { startOfMonth, endOfMonth, format, subDays, startOfDay, endOfDay } from "date-fns";

// Interface simplificada para Empréstimo
interface LoanInfo {
  id: string;
  institution: string;
  numeroContrato?: string;
}

// Interface simplificada para Investimento
interface InvestmentInfo {
  id: string;
  name: string;
}

interface ConsolidatedReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accounts: ContaCorrente[];
  categories: Categoria[];
  investments: InvestmentInfo[];
  loans: LoanInfo[];
}

export function ConsolidatedReviewDialog({
  open,
  onOpenChange,
  accountId,
  accounts,
  categories,
  investments,
  loans,
}: ConsolidatedReviewDialogProps) {
  const {
    getTransactionsForReview,
    standardizationRules,
    addStandardizationRule,
    addTransacaoV2,
    updateImportedStatement,
    importedStatements,
    markLoanParcelPaid,
    markSeguroParcelPaid,
    addEmprestimo,
    addVeiculo,
  } = useFinance();
  
  const account = accounts.find(a => a.id === accountId);
  
  // Estado para o período de filtro (usa o mês atual como padrão)
  const [reviewRange, setReviewRange] = useState<DateRange>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  
  // Estado para as transações em revisão (consolidadas e filtradas)
  const [transactionsToReview, setTransactionsToReview] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para o modal de regra
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [txForRule, setTxForRule] = useState<ImportedTransaction | null>(null);

  // 1. Carregar e filtrar transações pendentes
  const loadTransactions = useCallback(() => {
    if (!reviewRange.from || !reviewRange.to) {
      setTransactionsToReview([]);
      return;
    }
    setLoading(true);
    
    // Chama a função do contexto para consolidar e filtrar
    const consolidatedTxs = getTransactionsForReview(accountId, reviewRange);
    
    // Clonar para permitir edição local
    setTransactionsToReview(consolidatedTxs.map(tx => ({ ...tx })));
    setLoading(false);
  }, [accountId, reviewRange, getTransactionsForReview]);

  useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, loadTransactions]);
  
  // 2. Handlers para edição local na tabela
  const handleUpdateTransaction = useCallback((id: string, updates: Partial<ImportedTransaction>) => {
    setTransactionsToReview(prev => prev.map(tx => {
      if (tx.id === id) {
        const updatedTx = { ...tx, ...updates };
        
        // Lógica de limpeza de campos de vínculo ao mudar o tipo de operação
        if (updates.operationType && updates.operationType !== tx.operationType) {
            updatedTx.destinationAccountId = null;
            updatedTx.tempInvestmentId = null;
            updatedTx.tempLoanId = null;
            updatedTx.tempVehicleOperation = null;
            updatedTx.isTransfer = updates.operationType === 'transferencia';
        }
        
        return updatedTx;
      }
      return tx;
    }));
  }, []);
  
  // 3. Handler para criar regra
  const handleCreateRule = (tx: ImportedTransaction) => {
    setTxForRule(tx);
    setShowRuleModal(true);
  };
  
  const handleSaveRule = (rule: Omit<StandardizationRule, "id">) => {
    addStandardizationRule(rule);
    toast.success("Regra salva! Aplicando a transações pendentes...");
    
    // Reaplicar regras e recarregar a lista para ver o efeito imediato
    loadTransactions();
  };

  // 4. Contabilização (Processamento final)
  const handleContabilize = () => {
    const txsToContabilize = transactionsToReview.filter(tx => {
      // Verifica se a transação está pronta para ser contabilizada
      const isCategorized = tx.categoryId || tx.isTransfer || tx.tempInvestmentId || tx.tempLoanId || tx.tempVehicleOperation;
      return !!isCategorized;
    });
    
    if (txsToContabilize.length === 0) {
      toast.error("Nenhuma transação pronta para contabilização. Categorize ou vincule as pendentes.");
      return;
    }
    
    setLoading(true);
    const newTransactions: TransacaoCompleta[] = [];
    const contabilizedIds = new Set<string>();
    const updatedStatements = new Map<string, ImportedStatement>();
    
    // Mapeamento de IDs de transações brutas para seus extratos
    const txToStatementMap = new Map<string, string>();
    importedStatements.forEach(s => {
        s.rawTransactions.forEach(t => txToStatementMap.set(t.id, s.id));
    });

    txsToContabilize.forEach(tx => {
      const transactionId = generateTransactionId();
      const now = new Date().toISOString();
      
      const account = accounts.find(a => a.id === tx.accountId);
      const isCreditCard = account?.accountType === 'cartao_credito';
      
      const isIncoming = tx.operationType === 'receita' || tx.operationType === 'resgate' ||
                         tx.operationType === 'liberacao_emprestimo' || tx.operationType === 'rendimento' ||
                         (tx.operationType === 'veiculo' && tx.tempVehicleOperation === 'venda');
      
      let flow = getFlowTypeFromOperation(tx.operationType!, tx.tempVehicleOperation || undefined);
      
      // Ajuste de fluxo para Cartão de Crédito
      if (isCreditCard) {
        if (tx.operationType === 'despesa') flow = 'out'; 
        else if (tx.operationType === 'transferencia') flow = 'in'; 
      }

      const baseTx: TransacaoCompleta = {
        id: transactionId,
        date: tx.date,
        accountId: tx.accountId,
        flow: flow,
        operationType: tx.operationType!,
        domain: getDomainFromOperation(tx.operationType!),
        amount: tx.amount,
        categoryId: tx.categoryId || null,
        description: tx.description,
        links: {
          investmentId: tx.tempInvestmentId || null,
          loanId: tx.tempLoanId || null,
          transferGroupId: null,
          parcelaId: null,
          vehicleTransactionId: null,
        },
        conciliated: true, // Transações importadas e contabilizadas são consideradas conciliadas
        attachments: [],
        meta: {
          createdBy: 'system',
          source: 'import',
          createdAt: now,
          originalDescription: tx.originalDescription,
          vehicleOperation: tx.operationType === 'veiculo' ? tx.tempVehicleOperation || undefined : undefined,
        }
      };
      
      // 1. Transferência
      if (tx.isTransfer && tx.destinationAccountId) {
        const groupId = generateTransferGroupId();
        baseTx.links.transferGroupId = groupId;
        
        const fromAccount = accounts.find(a => a.id === tx.accountId);
        const toAccount = accounts.find(a => a.id === tx.destinationAccountId);
        const isToCreditCard = toAccount?.accountType === 'cartao_credito';
        
        // Transação de Saída (Conta Origem)
        const outTx: TransacaoCompleta = {
          ...baseTx,
          flow: 'transfer_out',
          description: tx.description || `Transferência para ${toAccount?.name}`,
        };
        newTransactions.push(outTx);
        
        // Transação de Entrada (Conta Destino)
        const inTx: TransacaoCompleta = {
          ...baseTx,
          id: generateTransactionId(),
          accountId: tx.destinationAccountId,
          flow: isToCreditCard ? 'in' : 'transfer_in', // CC payment is 'in'
          description: isToCreditCard ? `Pagamento de fatura CC ${toAccount?.name}` : tx.description || `Transferência recebida de ${fromAccount?.name}`,
        };
        newTransactions.push(inTx);
        
      } 
      // 2. Aplicação/Resgate
      else if (tx.operationType === 'aplicacao' || tx.operationType === 'resgate') {
        const isAplicacao = tx.operationType === 'aplicacao';
        const groupId = isAplicacao ? `app_${Date.now()}` : `res_${Date.now()}`;
        baseTx.links.transferGroupId = groupId;
        
        // Transação 1: Conta Corrente (Saída/Entrada)
        newTransactions.push(baseTx);
        
        // Transação 2: Conta Investimento (Entrada/Saída)
        const secondaryTx: TransacaoCompleta = {
          ...baseTx,
          id: generateTransactionId(),
          accountId: tx.tempInvestmentId!,
          flow: isAplicacao ? 'in' : 'out',
          operationType: isAplicacao ? 'aplicacao' : 'resgate',
          domain: 'investment',
          description: isAplicacao ? (tx.description || `Aplicação recebida`) : (tx.description || `Resgate enviado`),
          links: {
            ...baseTx.links,
            investmentId: baseTx.accountId, // Link de volta para a conta corrente
          },
          meta: { ...baseTx.meta, createdBy: 'system' }
        };
        newTransactions.push(secondaryTx);
      }
      // 3. Liberação Empréstimo
      else if (tx.operationType === 'liberacao_emprestimo') {
        newTransactions.push(baseTx);
        addEmprestimo({
          contrato: tx.description,
          valorTotal: tx.amount,
          parcela: 0,
          meses: 0,
          taxaMensal: 0,
          status: 'pendente_config',
          liberacaoTransactionId: baseTx.id,
          contaCorrenteId: baseTx.accountId,
          dataInicio: baseTx.date,
        });
      }
      // 4. Pagamento Empréstimo
      else if (tx.operationType === 'pagamento_emprestimo' && tx.tempLoanId) {
        newTransactions.push(baseTx);
        const loanIdNum = parseInt(tx.tempLoanId.replace('loan_', ''));
        // NOTE: Não podemos determinar o número da parcela aqui, pois o extrato não informa.
        // O usuário precisará vincular a parcela manualmente na tela de Empréstimos se quiser o cronograma exato.
        // Por enquanto, apenas marcamos o pagamento no loan tracker (se houver)
        if (!isNaN(loanIdNum)) {
            markLoanParcelPaid(loanIdNum, tx.amount, tx.date);
        }
      }
      // 5. Compra de Veículo
      else if (tx.operationType === 'veiculo' && tx.tempVehicleOperation === 'compra') {
        newTransactions.push(baseTx);
        addVeiculo({
            modelo: tx.description,
            marca: '',
            tipo: 'carro', // Default
            ano: 0,
            dataCompra: tx.date,
            valorVeiculo: tx.amount,
            valorSeguro: 0,
            vencimentoSeguro: "",
            parcelaSeguro: 0,
            valorFipe: 0,
            compraTransactionId: baseTx.id,
            status: 'pendente_cadastro',
        });
      }
      // 6. Transação Simples (Receita/Despesa/Rendimento)
      else {
        newTransactions.push(baseTx);
      }
      
      contabilizedIds.add(tx.id);
      
      // Rastrear qual statement precisa ser atualizado
      const statementId = txToStatementMap.get(tx.id);
      if (statementId) {
          if (!updatedStatements.has(statementId)) {
              const originalStatement = importedStatements.find(s => s.id === statementId);
              if (originalStatement) {
                  updatedStatements.set(statementId, { ...originalStatement });
              }
          }
          const statement = updatedStatements.get(statementId);
          if (statement) {
              statement.rawTransactions = statement.rawTransactions.map(rawTx => 
                  rawTx.id === tx.id ? { ...rawTx, isContabilized: true, contabilizedTransactionId: transactionId } : rawTx
              );
          }
      }
    });
    
    // 5. Persistir no contexto
    newTransactions.forEach(t => addTransacaoV2(t));
    
    // 6. Atualizar status dos statements
    updatedStatements.forEach(s => {
        const pendingCount = s.rawTransactions.filter(t => !t.isContabilized).length;
        const newStatus = pendingCount === 0 ? 'complete' : 'partial';
        updateImportedStatement(s.id, { rawTransactions: s.rawTransactions, status: newStatus });
    });
    
    setLoading(false);
    toast.success(`${txsToContabilize.length} transações contabilizadas com sucesso!`);
    onOpenChange(false);
  };
  
  // Lógica para o PeriodSelector (simples, pois não precisamos de range2 aqui)
  const handlePeriodChange = (ranges: ComparisonDateRanges) => {
    setReviewRange(ranges.range1);
  };
  
  // Simulação de ranges para o PeriodSelector
  const dummyRanges: ComparisonDateRanges = useMemo(() => ({
    range1: reviewRange,
    range2: { from: undefined, to: undefined }
  }), [reviewRange]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <DialogTitle className="text-xl">Revisão Consolidada - {account?.name}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {transactionsToReview.length} transações pendentes de {importedStatements.filter(s => s.accountId === accountId).length} extrato(s)
                  </DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filtro de Período */}
            <div className="p-4 border-b shrink-0 flex items-center gap-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtrar por Período:</span>
              <PeriodSelector 
                initialRanges={dummyRanges}
                onDateRangeChange={handlePeriodChange}
                className="w-[280px]"
              />
              <Button onClick={loadTransactions} variant="outline" size="sm" className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Aplicar Filtro
              </Button>
            </div>

            {/* Tabela de Revisão */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    Carregando transações...
                  </div>
                ) : transactionsToReview.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Check className="w-8 h-8 text-success mb-3" />
                    <p className="text-lg font-medium">Nenhuma transação pendente neste período.</p>
                    <p className="text-sm">Importe mais extratos ou ajuste o filtro de datas.</p>
                  </div>
                ) : (
                  <TransactionReviewTable
                    transactions={transactionsToReview}
                    accounts={accounts}
                    categories={categories}
                    investments={investments}
                    loans={loans}
                    onUpdateTransaction={handleUpdateTransaction}
                    onCreateRule={handleCreateRule}
                  />
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Footer de Ação */}
          <div className="p-4 border-t shrink-0">
            <Button 
              onClick={handleContabilize} 
              disabled={loading || transactionsToReview.length === 0}
              className="w-full gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Contabilizar {transactionsToReview.length} Transação(ões)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Criação de Regra */}
      <StandardizationRuleFormModal
        open={showRuleModal}
        onOpenChange={setShowRuleModal}
        initialTransaction={txForRule}
        categories={categories}
        onSave={handleSaveRule}
      />
    </>
  );
}