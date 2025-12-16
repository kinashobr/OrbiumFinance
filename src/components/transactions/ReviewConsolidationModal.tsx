import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, FileText, AlertCircle, Loader2, Pin } from "lucide-react";
import { 
  ContaCorrente, ImportedTransaction, TransacaoCompleta, TransactionLinks, TransactionMeta,
  generateTransactionId, generateTransferGroupId, getDomainFromOperation, TransferGroup, DateRange, StandardizationRule
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { cn, parseDateLocal } from "@/lib/utils";
import { TransactionReviewTable } from "./TransactionReviewTable";
import { StandardizationRuleFormModal } from "./StandardizationRuleFormModal";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { startOfMonth, endOfMonth, format, min, max } from "date-fns";

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

interface ReviewConsolidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}

export function ReviewConsolidationModal({ open, onOpenChange, accountId }: ReviewConsolidationModalProps) {
  const { 
    contasMovimento, 
    categoriasV2, 
    standardizationRules, 
    addStandardizationRule,
    addTransacaoV2,
    addEmprestimo, 
    addVeiculo, 
    markLoanParcelPaid, 
    markSeguroParcelPaid,
    importedStatements,
    markStatementContabilized,
    getTransactionsForReview,
    emprestimos,
  } = useFinance();
  
  const selectedAccount = useMemo(() => contasMovimento.find(a => a.id === accountId), [contasMovimento, accountId]);
  
  // 1. Determinar o período padrão (min/max das transações pendentes)
  const allPendingTransactions = useMemo(() => 
    importedStatements
      .filter(s => s.accountId === accountId && s.status === 'pending_review')
      .flatMap(s => s.rawTransactions),
    [importedStatements, accountId]
  );
  
  const defaultRange = useMemo(() => {
    if (allPendingTransactions.length === 0) {
      const now = new Date();
      return { from: startOfMonth(now), to: endOfMonth(now) };
    }
    const dates = allPendingTransactions.map(t => parseDateLocal(t.date));
    return { from: min(dates), to: max(dates) };
  }, [allPendingTransactions]);
  
  const [reviewRange, setReviewRange] = useState<DateRange>(defaultRange);
  
  // Sincroniza o reviewRange com o defaultRange quando o modal abre ou a conta muda
  useEffect(() => {
    if (open) {
        setReviewRange(defaultRange);
    }
  }, [open, defaultRange]);

  // 2. Carregar e gerenciar transações para revisão (estado local)
  const rawTransactions = useMemo(() => 
    getTransactionsForReview(accountId, reviewRange),
    [accountId, reviewRange, getTransactionsForReview]
  );
  
  const [transactionsToReview, setTransactionsToReview] = useState<ImportedTransaction[]>([]);
  
  // Inicializa o estado local com as transações brutas do contexto
  useEffect(() => {
    if (open) {
        setTransactionsToReview(rawTransactions);
    }
  }, [open, rawTransactions]);

  // 3. Dados de Vínculo (para a tabela de revisão)
  const investmentAccounts: InvestmentInfo[] = useMemo(() => 
    contasMovimento
      .filter(c => ['aplicacao_renda_fixa', 'poupanca', 'criptoativos', 'reserva_emergencia', 'objetivos_financeiros'].includes(c.accountType))
      .map(i => ({ id: i.id, name: i.name })),
    [contasMovimento]
  );
  
  const activeLoans: LoanInfo[] = useMemo(() => 
    emprestimos
      .filter(e => e.status === 'ativo')
      .map(e => ({ id: `loan_${e.id}`, institution: e.contrato, numeroContrato: e.contrato })),
    [emprestimos]
  );

  // 4. Handlers de Revisão
  const handleUpdateTransaction = (id: string, updates: Partial<ImportedTransaction>) => {
    setTransactionsToReview(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  };
  
  // 5. Regras de Padronização
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [txToCreateRule, setTxToCreateRule] = useState<ImportedTransaction | null>(null);
  
  const handleCreateRule = (tx: ImportedTransaction) => {
    setTxToCreateRule(tx);
    setShowRuleModal(true);
  };
  
  const handleSaveRule = (rule: Omit<StandardizationRule, "id">) => {
    addStandardizationRule(rule);
    
    // Reaplicar regras nas transações importadas para ver o efeito imediato
    const newRule: StandardizationRule = { ...rule, id: generateStatementId() }; // Usando generateStatementId como ID temporário para a regra
    
    const applyRules = (transactions: ImportedTransaction[], rules: StandardizationRule[]): ImportedTransaction[] => {
        return transactions.map(tx => {
            let updatedTx = { ...tx };
            const originalDesc = tx.originalDescription.toLowerCase();
            
            for (const r of rules) {
                if (originalDesc.includes(r.pattern.toLowerCase())) {
                    updatedTx.categoryId = r.categoryId;
                    updatedTx.operationType = r.operationType;
                    updatedTx.description = r.descriptionTemplate;
                    
                    if (r.operationType === 'transferencia') {
                        updatedTx.isTransfer = true;
                        updatedTx.tempInvestmentId = null;
                        updatedTx.tempLoanId = null;
                        updatedTx.tempVehicleOperation = null;
                    } else {
                        updatedTx.isTransfer = false;
                        updatedTx.destinationAccountId = null;
                    }
                    break;
                }
            }
            return updatedTx;
        });
    };
    
    // Aplica a nova regra (e as existentes)
    const allRules = [...standardizationRules, newRule];
    const reProcessedTransactions = applyRules(rawTransactions, allRules); // Use rawTransactions to re-process all
    setTransactionsToReview(reProcessedTransactions);
  };

  // 6. Contabilização Final
  const handleContabilizar = () => {
    const newTransactions: TransacaoCompleta[] = [];
    const statementsToMarkContabilized = new Set<string>();
    
    // 1. Validação final
    const incompleteTx = transactionsToReview.filter(tx => {
        if (!tx.operationType) return true;
        
        if (tx.operationType === 'transferencia' && !tx.destinationAccountId) return true;
        if ((tx.operationType === 'aplicacao' || tx.operationType === 'resgate') && !tx.tempInvestmentId) return true;
        if (tx.operationType === 'pagamento_emprestimo' && !tx.tempLoanId) return true;
        if (tx.operationType === 'veiculo' && !tx.tempVehicleOperation) return true;
        
        // Liberação de empréstimo não precisa de categoria, mas precisa de descrição
        if (tx.operationType === 'liberacao_emprestimo' && !tx.description) return true;
        
        // Outros: Requer categoria
        if (['receita', 'despesa', 'rendimento'].includes(tx.operationType) && !tx.categoryId) return true;
        
        return false;
    });
    
    if (incompleteTx.length > 0) {
        toast.error(`Atenção: ${incompleteTx.length} transação(ões) pendente(s) de configuração.`);
        return;
    }
    
    // 2. Conversão e criação
    transactionsToReview.forEach(tx => {
        const now = new Date().toISOString();
        const isTransfer = tx.operationType === 'transferencia';
        const isInvestmentFlow = tx.operationType === 'aplicacao' || tx.operationType === 'resgate';
        const isLoanPayment = tx.operationType === 'pagamento_emprestimo';
        const isLoanLiberation = tx.operationType === 'liberacao_emprestimo';
        const isVehicleTx = tx.operationType === 'veiculo';
        
        // Determina o fluxo (in/out)
        let flow: TransacaoCompleta['flow'] = 'out';
        if (tx.operationType === 'receita' || tx.operationType === 'rendimento' || isLoanLiberation || (isVehicleTx && tx.tempVehicleOperation === 'venda')) {
            flow = 'in';
        } else if (isTransfer) {
            flow = 'transfer_out';
        } else if (isInvestmentFlow && tx.operationType === 'resgate') {
            flow = 'in';
        } else {
            flow = 'out';
        }
        
        // Links
        const links: TransactionLinks = {
            investmentId: isInvestmentFlow ? tx.tempInvestmentId : null,
            loanId: isLoanPayment ? tx.tempLoanId : (isLoanLiberation ? tx.tempLoanId : null),
            transferGroupId: isTransfer ? generateTransferGroupId() : null,
            parcelaId: isLoanPayment ? '1' : null, // Simplificação: assume parcela 1 para importação
            vehicleTransactionId: isVehicleTx ? `veh_${tx.id}` : null,
        };
        
        // Meta
        const meta: TransactionMeta = {
            createdBy: 'system',
            source: 'import',
            createdAt: now,
            originalDescription: tx.originalDescription,
            vehicleOperation: isVehicleTx ? tx.tempVehicleOperation || 'compra' : undefined,
            numeroContrato: isLoanLiberation ? tx.description : undefined,
        };
        
        // Transação principal (na conta importada)
        const primaryTx: TransacaoCompleta = {
            id: tx.id,
            date: tx.date,
            accountId: tx.accountId,
            flow: flow,
            operationType: tx.operationType!,
            domain: getDomainFromOperation(tx.operationType!),
            amount: tx.amount,
            categoryId: tx.categoryId || null,
            description: tx.description,
            links: links,
            conciliated: true,
            attachments: [],
            meta: meta,
        };
        
        newTransactions.push(primaryTx);
        statementsToMarkContabilized.add(tx.statementId); // Marca o statement de origem
        
        // 3. Criação da transação de contrapartida (se necessário)
        
        // A. Transferência
        if (isTransfer && tx.destinationAccountId) {
            const transferGroupId = primaryTx.links.transferGroupId!;
            const secondaryTx: TransacaoCompleta = {
                ...primaryTx,
                id: generateTransactionId(),
                accountId: tx.destinationAccountId,
                flow: 'transfer_in',
                operationType: 'transferencia',
                description: `Transferência recebida de ${selectedAccount?.name || 'Conta Externa'}`,
                links: { ...primaryTx.links, transferGroupId },
                meta: { ...primaryTx.meta, createdBy: 'system' }
            };
            newTransactions.push(secondaryTx);
        }
        
        // B. Aplicação / Resgate
        if (isInvestmentFlow && tx.tempInvestmentId) {
            const isAplicacao = tx.operationType === 'aplicacao';
            const secondaryTx: TransacaoCompleta = {
                ...primaryTx,
                id: generateTransactionId(),
                accountId: tx.tempInvestmentId,
                flow: isAplicacao ? 'in' : 'out',
                operationType: isAplicacao ? 'aplicacao' : 'resgate',
                domain: 'investment',
                description: isAplicacao ? (tx.description || `Aplicação recebida de conta corrente`) : (tx.description || `Resgate enviado para conta corrente`),
                links: {
                    ...primaryTx.links,
                    investmentId: primaryTx.accountId, // Referência à conta oposta
                },
                meta: { ...primaryTx.meta, createdBy: 'system' }
            };
            newTransactions.push(secondaryTx);
        }
        
        // 4. Ações de Entidade (Empréstimo/Veículo)
        
        if (isLoanLiberation) {
            addEmprestimo({
                contrato: tx.description,
                valorTotal: tx.amount,
                parcela: 0,
                meses: 0,
                taxaMensal: 0,
                status: 'pendente_config',
                liberacaoTransactionId: primaryTx.id,
                contaCorrenteId: primaryTx.accountId,
                dataInicio: primaryTx.date,
            });
        }
        
        if (isLoanPayment && tx.tempLoanId) {
            const loanIdNum = parseInt(tx.tempLoanId.replace('loan_', ''));
            if (!isNaN(loanIdNum)) {
                markLoanParcelPaid(loanIdNum, tx.amount, tx.date, 1);
            }
        }
        
        if (isVehicleTx && tx.tempVehicleOperation === 'compra') {
            addVeiculo({
                modelo: tx.description,
                marca: '',
                tipo: 'carro',
                ano: 0,
                dataCompra: tx.date,
                valorVeiculo: tx.amount,
                valorSeguro: 0,
                vencimentoSeguro: "",
                parcelaSeguro: 0,
                valorFipe: 0,
                compraTransactionId: primaryTx.id,
                status: 'pendente_cadastro',
            });
        }
    });
    
    // 5. Adiciona todas as transações ao contexto
    newTransactions.forEach(t => addTransacaoV2(t));
    
    // 6. Marca os statements de origem como contabilizados
    markStatementContabilized(Array.from(statementsToMarkContabilized));
    
    toast.success(`${newTransactions.length} lançamentos contabilizados com sucesso!`);
    onOpenChange(false);
  };

  const allCategorized = transactionsToReview.every(tx => {
    if (!tx.operationType) return false;
    
    if (tx.operationType === 'transferencia') return !!tx.destinationAccountId;
    if ((tx.operationType === 'aplicacao' || tx.operationType === 'resgate') && !tx.tempInvestmentId) return true;
    if (tx.operationType === 'pagamento_emprestimo' && !tx.tempLoanId) return true;
    if (tx.operationType === 'veiculo' && !tx.tempVehicleOperation) return true;
    
    return !!tx.categoryId || tx.operationType === 'liberacao_emprestimo';
  });
  
  const incompleteCount = transactionsToReview.length - transactionsToReview.filter(tx => {
    if (!tx.operationType) return false;
    if (tx.operationType === 'transferencia') return !!tx.destinationAccountId;
    if ((tx.operationType === 'aplicacao' || tx.operationType === 'resgate') && !!tx.tempInvestmentId) return true;
    if (tx.operationType === 'pagamento_emprestimo' && !!tx.tempLoanId) return true;
    if (tx.operationType === 'veiculo' && !!tx.tempVehicleOperation) return true;
    return !!tx.categoryId || tx.operationType === 'liberacao_emprestimo';
  }).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Revisão Consolidada - {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Revise e categorize as transações dos extratos importados no período selecionado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6 pr-7 space-y-4">
            
            {/* Seletor de Período */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-sm font-medium text-foreground">Período de Revisão:</span>
                <PeriodSelector 
                    initialRanges={{ range1: reviewRange, range2: { from: undefined, to: undefined } }}
                    onDateRangeChange={(ranges) => setReviewRange(ranges.range1)}
                    className="w-[300px]"
                />
            </div>
            
            {/* Status de Revisão */}
            <div className={cn(
                "p-3 rounded-lg border flex items-center justify-between",
                allCategorized ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"
            )}>
                <div>
                    <p className="text-sm font-medium text-foreground">
                    {transactionsToReview.length} transações no período.
                    </p>
                    <p className={cn("text-xs mt-1", allCategorized ? "text-success" : "text-warning")}>
                        {allCategorized 
                            ? <><Check className="w-3 h-3 inline mr-1" /> Todas prontas para contabilização.</>
                            : <><AlertCircle className="w-3 h-3 inline mr-1" /> {incompleteCount} transação(ões) pendente(s) de configuração.</>
                        }
                    </p>
                </div>
                <Button 
                    onClick={handleContabilizar} 
                    className="bg-success hover:bg-success/90 gap-2"
                    disabled={!allCategorized || transactionsToReview.length === 0}
                >
                    <Check className="w-4 h-4" />
                    Contabilizar ({transactionsToReview.length})
                </Button>
            </div>

            {/* Tabela de Revisão */}
            <ScrollArea className="h-[60vh] max-h-[600px] border rounded-lg">
              <TransactionReviewTable
                  transactions={transactionsToReview}
                  accounts={contasMovimento}
                  categories={categoriasV2}
                  investments={investmentAccounts}
                  loans={activeLoans}
                  onUpdateTransaction={handleUpdateTransaction}
                  onCreateRule={handleCreateRule}
              />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      <StandardizationRuleFormModal
        open={showRuleModal}
        onOpenChange={setShowRuleModal}
        initialTransaction={txToCreateRule}
        categories={categoriasV2}
        onSave={handleSaveRule}
      />
    </>
  );
}