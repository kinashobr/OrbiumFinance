import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, CreditCard, Calculator, TrendingDown, Percent, Calendar, DollarSign, Eye, Clock, Award, PiggyBank, Target, ChevronRight, AlertTriangle, Building2 } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { Emprestimo } from "@/types/finance";
import { EditableCell } from "@/components/EditableCell";
import { LoanCard } from "@/components/loans/LoanCard";
import { LoanForm } from "@/components/loans/LoanForm";
import { LoanAlerts } from "@/components/loans/LoanAlerts";
import { LoanCharts } from "@/components/loans/LoanCharts";
import { LoanDetailDialog } from "@/components/loans/LoanDetailDialog";
import { PeriodSelector, DateRange } from "@/components/dashboard/PeriodSelector";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, isWithinInterval, format } from "date-fns";

const Emprestimos = () => {
  const { 
    emprestimos, 
    addEmprestimo, 
    updateEmprestimo, 
    deleteEmprestimo, 
    getTotalDividas,
    getPendingLoans,
    getContasCorrentesTipo,
    transacoesV2
  } = useFinance();
  
  const [selectedLoan, setSelectedLoan] = useState<Emprestimo | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Inicializa o range para o mês atual
  const now = new Date();
  const initialRange: DateRange = { from: startOfMonth(now), to: endOfMonth(now) };
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);

  const handlePeriodChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Helper function to calculate the next due date for a loan
// ... rest of the file remains the same