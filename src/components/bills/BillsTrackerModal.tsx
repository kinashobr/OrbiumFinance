import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Repeat, DollarSign, AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { BillTracker, PotentialFixedBill, generateBillId, formatCurrency, BillSourceType } from "@/types/finance";
import { BillsTrackerList } from "./BillsTrackerList";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, isBefore, isAfter, isSameDay } from "date-fns";
import { cn, parseDateLocal } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

interface BillsTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillsTrackerModal({ open, onOpenChange }: BillsTrackerModalProps) {
  const { 
    billsTracker, 
    setBillsTracker, 
    updateBill, 
    deleteBill, 
    getBillsForMonth, 
    getPotentialFixedBillsForMonth,
    getFutureFixedBills,
    contasMovimento,
    transacoesV2,
    addTransacaoV2,
    categoriasV2,
    markLoanParcelPaid,
    markSeguroParcelPaid,
  } = useFinance();
  
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState("current");

  // 1. Contas do Mês (Persistidas + Fixas Incluídas)
  const localBills = useMemo(() => getBillsForMonth(currentMonth), [currentMonth, getBillsForMonth]);
  
  // 2. Contas Fixas Potenciais (Empréstimos/Seguros)
  const potentialFixedBills = useMemo(() => getPotentialFixedBillsForMonth(currentMonth, localBills), [currentMonth, getPotentialFixedBillsForMonth, localBills]);
  
  // 3. Contas Futuras (Empréstimos/Seguros)
  const futureFixedBills = useMemo(() => getFutureFixedBills(currentMonth, localBills), [currentMonth, getFutureFixedBills, localBills]);

  // Consolidar a lista de contas a pagar para exibição
  const consolidatedBills = useMemo(() => {
    // Começa com as contas locais (ad-hoc, fixed, variable, e as fixas incluídas)
    const billsMap = new Map<string, BillTracker>();
    localBills.forEach(bill => billsMap.set(bill.id, bill));
    
    // Adiciona as contas fixas potenciais que AINDA NÃO ESTÃO incluídas (isIncluded=false)
    potentialFixedBills.forEach(potential => {
        const isAlreadyIncluded = localBills.some(b => 
            b.sourceType === potential.sourceType && 
            b.sourceRef === potential.sourceRef && 
            b.parcelaNumber === potential.parcelaNumber
        );
        
        if (!isAlreadyIncluded) {
            // Cria um BillTracker temporário para exibição/inclusão
            const tempBill: BillTracker = {
                id: generateBillId(), // ID temporário
                description: potential.description,
                dueDate: potential.dueDate,
                expectedAmount: potential.expectedAmount,
                isPaid: potential.isPaid,
                sourceType: potential.sourceType,
                sourceRef: potential.sourceRef,
                parcelaNumber: potential.parcelaNumber,
                isExcluded: false,
                // Sugerir conta corrente padrão
                suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id,
                suggestedCategoryId: potentialBill.sourceType === 'loan_installment' 
                    ? categoriasV2.find(c => c.label.toLowerCase().includes('empréstimo'))?.id || null
                    : categoriasV2.find(c => c.label.toLowerCase().includes('seguro'))?.id || null,
            };
            billsMap.set(tempBill.id, tempBill);
        }
    });
    
    // Filtra as contas que não foram excluídas
    return Array.from(billsMap.values()).filter(b => !b.isExcluded);
  }, [localBills, potentialFixedBills, contasMovimento, categoriasV2]);

  // Handlers de Navegação
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  // Handlers de CRUD/Ação
  const handleAddBill = (bill: Omit<BillTracker, "id" | "isPaid">) => {
    const newBill: BillTracker = {
      ...bill,
      id: generateBillId(),
      isPaid: false,
      // Garante que a data de vencimento está no mês atual se for ad-hoc
      dueDate: bill.sourceType === 'ad_hoc' ? format(currentMonth, 'yyyy-MM-dd') : bill.dueDate,
    };
    setBillsTracker(prev => [...prev, newBill]);
  };

  const handleUpdateBill = (id: string, updates: Partial<BillTracker>) => {
    setBillsTracker(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleDeleteBill = (id: string) => {
    setBillsTracker(prev => prev.filter(b => b.id !== id));
  };
  
  const handleIncludeBill = (potentialBill: PotentialFixedBill) => {
    // 1. Cria a BillTracker a partir da PotentialFixedBill
    const newBill: BillTracker = {
        id: generateBillId(),
        description: potentialBill.description,
        dueDate: potentialBill.dueDate,
        expectedAmount: potentialBill.expectedAmount,
        isPaid: potentialBill.isPaid,
        paymentDate: potentialBill.isPaid ? format(new Date(), 'yyyy-MM-dd') : undefined, // Se já paga, marca a data de hoje
        sourceType: potentialBill.sourceType,
        sourceRef: potentialBill.sourceRef,
        parcelaNumber: potentialBill.parcelaNumber,
        isExcluded: false,
        // Sugerir conta corrente padrão
        suggestedAccountId: contasMovimento.find(c => c.accountType === 'corrente')?.id,
        suggestedCategoryId: potentialBill.sourceType === 'loan_installment'
            ? categoriasV2.find(c => c.label.toLowerCase().includes('empréstimo'))?.id || null
            : categoriasV2.find(c => c.label.toLowerCase().includes('seguro'))?.id || null,
    };
    
    // 2. Adiciona ao BillsTracker
    setBillsTracker(prev => [...prev, newBill]);
    toast.success(`Conta fixa '${potentialBill.description}' incluída no rastreador.`);
  };
  
  const handleTogglePaid = (bill: BillTracker, isChecked: boolean) => {
    if (isChecked) {
      // Marcar como pago: Criar transação e vincular
      if (!bill.suggestedAccountId) {
        toast.error("Selecione a conta de pagamento antes de marcar como pago.");
        return;
      }
      
      const categoryId = bill.suggestedCategoryId || categoriasV2.find(c => c.label.toLowerCase().includes('despesa'))?.id || null;
      
      const transaction: Omit<TransacaoCompleta, 'id' | 'flow' | 'domain' | 'conciliated' | 'attachments' | 'meta'> & { links: any, meta: any } = {
        date: format(new Date(), 'yyyy-MM-dd'), // Data de pagamento é hoje
        accountId: bill.suggestedAccountId,
        operationType: 'despesa',
        amount: bill.expectedAmount,
        categoryId: categoryId,
        description: bill.description,
        links: {
            investmentId: null,
            loanId: bill.sourceType === 'loan_installment' ? bill.sourceRef : null,
            transferGroupId: null,
            parcelaId: bill.parcelaNumber ? String(bill.parcelaNumber) : null,
            vehicleTransactionId: bill.sourceType === 'insurance_installment' ? `${bill.sourceRef}_${bill.parcelaNumber}` : null,
        },
        meta: {
            createdBy: 'user',
            source: 'bill_tracker',
            createdAt: new Date().toISOString(),
        }
      };
      
      const newTxId = generateBillId(); // Reusing ID generator for simplicity
      
      addTransacaoV2({
          ...transaction,
          id: newTxId,
          flow: 'out',
          domain: 'operational',
          conciliated: false,
          attachments: [],
          meta: {
              ...transaction.meta,
              source: 'bill_tracker',
          }
      } as TransacaoCompleta);
      
      // Atualizar BillTracker com status de pago e ID da transação
      updateBill(bill.id, { 
        isPaid: true, 
        paymentDate: format(new Date(), 'yyyy-MM-dd'), 
        transactionId: newTxId 
      });
      
      // Se for parcela de empréstimo/seguro, atualizar a entidade V2
      if (bill.sourceType === 'loan_installment' && bill.sourceRef && bill.parcelaNumber) {
          const loanId = parseInt(bill.sourceRef);
          markLoanParcelPaid(loanId, bill.expectedAmount, format(new Date(), 'yyyy-MM-dd'), bill.parcelaNumber);
      }
      if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
          const seguroId = parseInt(bill.sourceRef);
          markSeguroParcelPaid(seguroId, bill.parcelaNumber, newTxId);
      }
      
      toast.success(`Conta '${bill.description}' paga e transação registrada!`);
      
    } else {
      // Marcar como pendente: Remover transação e desvincular
      if (bill.transactionId) {
        // Remove a transação
        setTransacoesV2(prev => prev.filter(t => t.id !== bill.transactionId));
        
        // Se for parcela de empréstimo/seguro, desmarcar na entidade V2
        if (bill.sourceType === 'loan_installment' && bill.sourceRef) {
            const loanId = parseInt(bill.sourceRef);
            // Simplificação: Apenas desmarca o status do empréstimo
            markLoanParcelPaid(loanId, 0, '', undefined); 
        }
        if (bill.sourceType === 'insurance_installment' && bill.sourceRef && bill.parcelaNumber) {
            const seguroId = parseInt(bill.sourceRef);
            markSeguroParcelPaid(seguroId, bill.parcelaNumber, bill.transactionId); // O unmarkSeguroParcelPaid precisa ser chamado
        }
      }
      
      updateBill(bill.id, { isPaid: false, paymentDate: undefined, transactionId: undefined });
      toast.info(`Pagamento de '${bill.description}' estornado.`);
    }
  };

  // Cálculos de Resumo
  const totalPending = consolidatedBills.filter(b => !b.isPaid).reduce((acc, b) => acc + b.expectedAmount, 0);
  const totalPaid = consolidatedBills.filter(b => b.isPaid).reduce((acc, b) => acc + b.expectedAmount, 0);
  const totalBills = totalPending + totalPaid;
  
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-card border-border overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            Contas a Pagar - {format(currentMonth, 'MMMM yyyy', { locale: { localize: { month: (n) => format(new Date(2000, n), 'MMM', { locale: { localize: { month: (n) => format(new Date(2000, n), 'MMMM') } } }).charAt(0).toUpperCase() + format(new Date(2000, n), 'MMMM').slice(1) } } })}
          </DialogTitle>
        </DialogHeader>

        {/* Navegação de Mês */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            Mês Anterior
          </Button>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h4>
            {!isCurrentMonth && (
              <Button variant="ghost" size="sm" onClick={goToCurrentMonth} className="text-primary">
                (Ir para Mês Atual)
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            Próximo Mês
          </Button>
        </div>

        {/* Resumo do Mês */}
        <div className="grid grid-cols-3 gap-4 mb-4 shrink-0">
          <Card className="glass-card stat-card-neutral">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Contas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{formatCurrency(totalBills)}</div>
            </CardContent>
          </Card>
          <Card className="glass-card stat-card-negative">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPending)}</div>
            </CardContent>
          </Card>
          <Card className="glass-card stat-card-positive">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Visualização */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-muted/50 shrink-0">
            <TabsTrigger value="current">Contas do Mês ({consolidatedBills.length})</TabsTrigger>
            <TabsTrigger value="potential">Fixas Potenciais ({potentialFixedBills.filter(b => !b.isIncluded).length})</TabsTrigger>
            <TabsTrigger value="future">Contas Futuras ({futureFixedBills.length})</TabsTrigger>
          </TabsList>

          {/* Tab 1: Contas do Mês (Consolidada) */}
          <TabsContent value="current" className="flex-1 flex flex-col min-h-0 mt-4">
            <BillsTrackerList
              bills={consolidatedBills}
              onUpdateBill={handleUpdateBill}
              onDeleteBill={handleDeleteBill}
              onAddBill={handleAddBill}
              onTogglePaid={handleTogglePaid}
              currentDate={currentMonth}
            />
          </TabsContent>

          {/* Tab 2: Fixas Potenciais (Para Inclusão) */}
          <TabsContent value="potential" className="flex-1 flex flex-col min-h-0 mt-4">
            <ScrollArea className="flex-1 rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[100px]">Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[120px]">Valor</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {potentialFixedBills.filter(b => !b.isIncluded).map((potentialBill) => (
                    <TableRow key={potentialBill.key}>
                      <TableCell>
                        <Badge variant="outline" className={cn(potentialBill.sourceType === 'loan_installment' ? 'text-orange-500' : 'text-blue-500')}>
                          {potentialBill.sourceType === 'loan_installment' ? 'Empréstimo' : 'Seguro'}
                        </Badge>
                      </TableCell>
                      <TableCell>{parseDateLocal(potentialBill.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{potentialBill.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(potentialBill.expectedAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(potentialBill.isPaid ? 'border-success text-success' : 'border-warning text-warning')}>
                          {potentialBill.isPaid ? 'Pago (Adiantado)' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-success hover:bg-success/10"
                          onClick={() => handleIncludeBill(potentialBill)}
                          title="Incluir no rastreador deste mês"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {potentialFixedBills.filter(b => !b.isIncluded).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-success" />
                        Todas as contas fixas deste mês já estão incluídas ou pagas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
          
          {/* Tab 3: Contas Futuras */}
          <TabsContent value="future" className="flex-1 flex flex-col min-h-0 mt-4">
            <ScrollArea className="flex-1 rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[100px]">Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[120px]">Valor</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futureFixedBills.map((futureBill) => (
                    <TableRow key={futureBill.key}>
                      <TableCell>
                        <Badge variant="outline" className={cn(futureBill.sourceType === 'loan_installment' ? 'text-orange-500' : 'text-blue-500')}>
                          {futureBill.sourceType === 'loan_installment' ? 'Empréstimo' : 'Seguro'}
                        </Badge>
                      </TableCell>
                      <TableCell>{parseDateLocal(futureBill.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{futureBill.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(futureBill.expectedAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(futureBill.isPaid ? 'border-success text-success' : 'border-primary text-primary')}>
                          {futureBill.isPaid ? 'Pago' : 'Futuro'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {futureFixedBills.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        <Clock className="w-6 h-6 mx-auto mb-2" />
                        Nenhuma conta fixa futura registrada após este mês.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}