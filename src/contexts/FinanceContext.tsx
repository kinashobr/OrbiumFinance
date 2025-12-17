import { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction, useCallback } from "react";
import {
  Categoria, TransacaoCompleta,
  DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES,
  ContaCorrente,
  FinanceExportV2,
  Emprestimo, // V2 Entity
  Veiculo, // V2 Entity
  SeguroVeiculo, // V2 Entity
  ObjetivoFinanceiro, // V2 Entity
  AccountType,
  DateRange, // Import new types
  ComparisonDateRanges, // Import new types
  generateAccountId,
  generateTransactionId,
  BillTracker, // NEW
  generateBillId, // NEW
  StandardizationRule, // <-- NEW IMPORT
  generateRuleId, // <-- NEW IMPORT
  ImportedStatement, // <-- NEW IMPORT
  ImportedTransaction, // <-- NEW IMPORT
  generateStatementId, // <-- NEW IMPORT
  OperationType, // <-- NEW IMPORT
  getFlowTypeFromOperation, // <-- NEW IMPORT
} from "@/types/finance";
import { parseISO, startOfMonth, endOfMonth, subDays, differenceInDays, differenceInMonths, addMonths, isBefore, isAfter, isSameDay, isSameMonth, isSameYear, startOfDay, endOfDay, subMonths, format, isWithinInterval } from "date-fns"; // Import date-fns helpers
import { parseDateLocal, getDueDate } from "@/lib/utils"; // Importando a nova função e getDueDate

// ============================================
// FUNÇÕES AUXILIARES PARA DATAS
// ============================================

const calculateDefaultRange = (): DateRange => {
// ... (restante do arquivo permanece o mesmo)