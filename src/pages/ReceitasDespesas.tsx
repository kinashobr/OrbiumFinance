import { useState, useMemo, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tags, Plus, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { isWithinInterval, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, addMonths, format } from "date-fns";

// Types
import { 
  ContaCorrente, Categoria, TransacaoCompleta, TransferGroup,
  AccountSummary, OperationType, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, 
  generateTransactionId, formatCurrency, generateTransferGroupId,
  DateRange, ComparisonDateRanges, TransactionLinks
} from "@/types/finance";

// Components
import { AccountsCarousel } from "@/components/transactions/AccountsCarousel";
import { MovimentarContaModal } from "@/components/transactions/MovimentarContaModal";
import { KPISidebar } from "@/components/transactions/KPISidebar";
import { ReconciliationPanel } from "@/components/transactions/ReconciliationPanel";
import { AccountFormModal } from "@/components/transactions/AccountFormModal";
import { CategoryFormModal } from "@/components/transactions/CategoryFormModal";
import { CategoryListModal } from "@/components/transactions/CategoryListModal";
import { AccountStatementDialog } from "@/components/transactions/AccountStatementDialog";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { BillsTrackerModal } from "@/components/bills/BillsTrackerModal";
import { StatementManagerDialog } from "@/components/transactions/StatementManagerDialog"; 
import { ConsolidatedReviewDialog } from "@/components/transactions/ConsolidatedReviewDialog";
import { TransactionFilters } from "@/components/transactions/TransactionFilters"; // <-- IMPORT CORRIGIDO

// Context
import { useFinance } from "@/contexts/FinanceContext";
import { parseDateLocal } from "@/lib/utils";
import { TransactionTable } from "@/components/transactions/TransactionTable"; // ADDED

const ReceitasDespesas = () => {
// ... (restante do arquivo)