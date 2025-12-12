"use client";

import { useState, useMemo, useCallback } => "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, TrendingUp, Wallet, Target, Shield, Bitcoin, DollarSign, ArrowUpRight, ArrowDownRight, Coins, CircleDollarSign, Landmark, History, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { EditableCell } from "@/components/EditableCell";
import { toast } from "sonner";
import { PeriodSelector, DateRange } from "@/components/dashboard/PeriodSelector";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ContaCorrente, TransacaoCompleta } from "@/types/finance";

const pieColors = [
  "hsl(142, 76%, 36%)",
  "hsl(199, 89%, 48%)",
  "hsl(270, 100%, 65%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
];

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// List of stablecoin identifiers
const STABLECOIN_NAMES = ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdp', 'gusd', 'frax', 'lusd', 'susd'];

const isStablecoin = (name: string): boolean => {
  return STABLECOIN_NAMES.some(s => name.toLowerCase().includes(s));
};

const Investimentos = () => {
  const { 
    contasMovimento,
    transacoesV2,
    getValorFipeTotal,
    getTotalReceitas,
    getTotalDespesas,
    categoriasV2, // Adicionado categoriasV2
    addTransacaoV2, // Adicionado addTransacaoV2
    // Funções V1 mantidas para evitar erros de compilação, mas não usadas aqui
    investimentosRF, 
    criptomoedas, 
    stablecoins, 
    objetivos, 
    addInvestimentoRF, 
    updateInvestimentoRF, 
    deleteInvestimentoRF, 
    addCriptomoeda, 
    updateCriptomoeda, 
    deleteCriptomoeda, 
    addStablecoin, 
    updateStablecoin, 
    deleteStablecoin, 
    addObjetivo, 
    updateObjetivo, 
    deleteObjetivo, 
    addMovimentacaoInvestimento,
    deleteMovimentacaoInvestimento,
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState("carteira");
  
  // Inicializa o range para o mês atual
  const now = new Date();
  const initialRange: DateRange = { from: startOfMonth(now), to: endOfMonth(now) };
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);

  // Dialogs
  const [showAddRendimento, setShowAddRendimento] = useState<string | null>(null); // Alterado para string (accountId)

  // Forms
  const [formRendimento, setFormRendimento] = useState({
    data: "",
    valor: "",
    descricao: ""
  });

  const handlePeriodChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Helper para calcular saldo atual de uma conta (sem filtro de data)
  const calculateBalanceUpToDate = useCallback((accountId: string, allTransactions: typeof transacoesV2, accounts: typeof contasMovimento): number => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;

    let balance = account.startDate ? 0 : account.initialBalance; 
    
    const transactionsBeforeDate = allTransactions
        .filter(t => t.accountId === accountId)
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    transactionsBeforeDate.forEach(t => {
        const isCreditCard = account.accountType === 'cartao_credito';
        
        if (isCreditCard) {
          if (t.operationType === 'despesa') {
            balance -= t.amount;
          } else if (t.operationType === 'transferencia') {
            balance += t.amount;
          }
        } else {
          if (t.flow === 'in' || t.flow === 'transfer_in' || t.operationType === 'initial_balance') {
            balance += t.amount;
          } else {
            balance -= t.amount;
          }
        }
    });

    return balance;
  }, [contasMovimento, transacoesV2]);

  // Separate accounts by type for tab filtering
  const investmentAccounts = useMemo(() => {
    return contasMovimento.filter(c => 
      c.accountType === 'aplicacao_renda_fixa' || 
      c.accountType === 'poupanca' ||
      c.accountType === 'criptoativos' ||
      c.accountType === 'reserva_emergencia' ||
      c.accountType === 'objetivos_financeiros'
    );
  }, [contasMovimento]);

  const rfAccounts = useMemo(() => {
    return investmentAccounts.filter(c => 
      c.accountType === 'aplicacao_renda_fixa' || c.accountType === 'poupanca'
    );
  }, [investmentAccounts]);

  const cryptoAccounts = useMemo(() => {
    return investmentAccounts.filter(c => 
      c.accountType === 'criptoativos' && !isStablecoin(c.name)
    );
  }, [investmentAccounts]);

  const stablecoinAccounts = useMemo(() => {
    return investmentAccounts.filter(c => 
      c.accountType === 'criptoativos' && isStablecoin(c.name)
    );
  }, [investmentAccounts]);

  const objetivosAccounts = useMemo(() => {
    return investmentAccounts.filter(c => 
      c.accountType === 'objetivos_financeiros' || c.accountType === 'reserva_emergencia'
    );
  }, [investmentAccounts]);

  // Cálculos padronizados
  const calculosPatrimonio = useMemo(() => {
    // Totais das Contas Movimento (V2)
    const totalRF = rfAccounts.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, transacoesV2, contasMovimento), 0);
    const totalCripto = cryptoAccounts.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, transacoesV2, contasMovimento), 0);
    const totalStables = stablecoinAccounts.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, transacoesV2, contasMovimento), 0);
    const totalObjetivos = objetivosAccounts.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, transacoesV2, contasMovimento), 0);

    const valorVeiculos = getValorFipeTotal();
    
    const patrimonioInvestimentos = totalRF + totalCripto + totalStables + totalObjetivos;
    const patrimonioTotal = patrimonioInvestimentos + valorVeiculos;
    
    const exposicaoCripto = patrimonioInvestimentos > 0 ? (totalCripto / patrimonioInvestimentos) * 100 : 0;
    
    // Rentabilidade Média (Simplificada, pois dados de rentabilidade V1 foram removidos)
    const rentabilidadeMedia = 5.0; // Valor placeholder
    
    const receitasMes = getTotalReceitas();
    const despesasMes = getTotalDespesas();
    const variacaoMensal = receitasMes > 0 ? ((receitasMes - despesasMes) / receitasMes) * 100 : 0;
    
    return {
      patrimonioTotal,
      totalRF,
      totalCripto,
      totalStables,
      totalObjetivos,
      valorVeiculos,
      exposicaoCripto,
      rentabilidadeMedia,
      variacaoMensal,
      patrimonioInvestimentos,
    };
  }, [contasMovimento, transacoesV2, rfAccounts, cryptoAccounts, stablecoinAccounts, objetivosAccounts, calculateBalanceUpToDate, getValorFipeTotal, getTotalReceitas, getTotalDespesas]);

  const distribuicaoCarteira = useMemo(() => [
    { name: "Renda Fixa", value: calculosPatrimonio.totalRF },
    { name: "Criptomoedas", value: calculosPatrimonio.totalCripto },
    { name: "Stablecoins", value: calculosPatrimonio.totalStables },
    { name: "Objetivos", value: calculosPatrimonio.totalObjetivos },
  ], [calculosPatrimonio]);

  const handleAddRendimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRendimento.data || !formRendimento.valor || !showAddRendimento) return;
    
    // Simular a adição de rendimento como uma transação de 'rendimento' na conta de investimento
    const accountId = showAddRendimento;
    const parsedAmount = Number(formRendimento.valor);

    const transaction: TransacaoCompleta = {
      id: `tx_${Date.now()}`,
      date: formRendimento.data,
      accountId,
      flow: 'in',
      operationType: 'rendimento',
      domain: 'investment',
      amount: parsedAmount,
      categoryId: categoriasV2.find(c => c.label === 'Rendimentos sobre Investimentos')?.id || null,
      description: formRendimento.descricao || "Rendimento de Aplicação",
      links: {
        investmentId: accountId,
        loanId: null,
        transferGroupId: null,
        parcelaId: null,
        vehicleTransactionId: null,
      },
      conciliated: false,
      attachments: [],
      meta: {
        createdBy: 'user',
        source: 'manual',
        createdAt: new Date().toISOString(),
      }
    };
    
    // Adicionar transação (o contexto se encarrega de atualizar o saldo)
    addTransacaoV2(transaction);
    
    setFormRendimento({ data: "", valor: "", descricao: "" });
    setShowAddRendimento(null);
    toast.success("Rendimento registrado!");
  };

  return (
// ... rest of the file remains the same