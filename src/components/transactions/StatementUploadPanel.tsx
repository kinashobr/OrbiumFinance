import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Check, X, Loader2, AlertCircle } from "lucide-react";
import { 
  ContaCorrente, ImportedTransaction, StandardizationRule, OperationType, 
  generateTransactionId, generateTransferGroupId, getDomainFromOperation, 
  ImportedStatement, generateStatementId
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";
import { min, max, format } from "date-fns";

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

interface StatementUploadPanelProps {
  accountId: string;
  onStatementAdded: (statement: Omit<ImportedStatement, "id" | "status">) => void;
  onLoadingChange: (isLoading: boolean) => void;
  disabled: boolean;
}

// ============================================
// FUNÇÕES DE PARSING (Fase 2)
// ============================================

// Helper para normalizar valor (R$ 1.234,56 -> 1234.56)
const normalizeAmount = (amountStr: string): number => {
    let cleaned = amountStr.trim();
    const isNegative = cleaned.startsWith('-');
    
    if (isNegative) {
        cleaned = cleaned.substring(1);
    }
    
    cleaned = cleaned.replace(/[^\d.,]/g, '');

    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.')) {
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            const lastPart = parts.pop();
            cleaned = parts.join('') + '.' + lastPart;
        }
    }
    
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) return 0;
    
    return isNegative ? -parsed : parsed;
};

// Helper para normalizar data OFX (YYYYMMDD -> YYYY-MM-DD)
const normalizeOfxDate = (dateStr: string): string => {
    if (dateStr.length >= 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
};

// Parsing CSV (Ajustado para ser mais flexível com separadores e formatos de data DD/MM/YYYY)
const parseCSV = (content: string, accountId: string): ImportedTransaction[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const separator = lines[0].includes('\t') ? '\t' : ',';
    
    const header = lines[0].toLowerCase();
    const cols = header.split(separator);
    
    const normalizeHeader = (h: string) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, '').trim();
    
    const dataIndex = cols.findIndex(h => normalizeHeader(h).includes('data'));
    const valorIndex = cols.findIndex(h => normalizeHeader(h).includes('valor'));
    const descIndex = cols.findIndex(h => normalizeHeader(h).includes('descri'));

    if (dataIndex === -1 || valorIndex === -1 || descIndex === -1) {
        throw new Error(`CSV inválido. Colunas 'Data', 'Valor' e 'Descrição' são obrigatórias. Separador detectado: '${separator}'`);
    }

    const transactions: ImportedTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
        const lineCols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        
        if (lineCols.length > Math.max(dataIndex, valorIndex, descIndex)) {
            const dateStr = lineCols[dataIndex];
            const amountStr = lineCols[valorIndex];
            const originalDescription = lineCols[descIndex];
            
            if (!dateStr || !amountStr || !originalDescription) continue;

            const amount = normalizeAmount(amountStr);
            
            let normalizedDate = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
            } else {
                normalizedDate = normalizeOfxDate(dateStr);
            }
            
            if (normalizedDate.length < 10 || isNaN(parseDateLocal(normalizedDate).getTime())) {
                continue;
            }

            transactions.push({
                id: generateTransactionId(),
                statementId: generateStatementId(), // Será sobrescrito pelo StatementManager
                date: normalizedDate,
                amount: Math.abs(amount),
                originalDescription,
                accountId,
                categoryId: null,
                operationType: amount < 0 ? 'despesa' : 'receita',
                description: originalDescription,
                isTransfer: false,
                destinationAccountId: null,
                tempInvestmentId: null,
                tempLoanId: null,
                tempVehicleOperation: null,
                sourceType: 'csv',
            });
        }
    }
    return transactions;
};

// Parsing OFX (SGML - usando regex tolerante)
const parseOFX = (content: string, accountId: string): ImportedTransaction[] => {
    const transactions: ImportedTransaction[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
        const stmtTrnBlock = match[1];
        
        const dtPostedMatch = stmtTrnBlock.match(/<DTPOSTED>(\d+)/);
        const trnAmtMatch = stmtTrnBlock.match(/<TRNAMT>([\d.-]+)/);
        const memoMatch = stmtTrnBlock.match(/<MEMO>([\s\S]*?)</);

        if (dtPostedMatch && trnAmtMatch && memoMatch) {
            const dateStr = dtPostedMatch[1];
            const amount = parseFloat(trnAmtMatch[1]);
            const originalDescription = memoMatch[1].trim();
            
            if (isNaN(amount)) continue;

            const normalizedDate = normalizeOfxDate(dateStr);
            
            const operationType: OperationType = amount < 0 ? 'despesa' : 'receita';

            transactions.push({
                id: generateTransactionId(),
                statementId: generateStatementId(), // Será sobrescrito pelo StatementManager
                date: normalizedDate,
                amount: Math.abs(amount),
                originalDescription,
                accountId,
                categoryId: null,
                operationType,
                description: originalDescription,
                isTransfer: false,
                destinationAccountId: null,
                tempInvestmentId: null,
                tempLoanId: null,
                tempVehicleOperation: null,
                sourceType: 'ofx',
            });
        }
    }
    return transactions;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function StatementUploadPanel({ accountId, onStatementAdded, onLoadingChange, disabled }: StatementUploadPanelProps) {
  const { standardizationRules } = useFinance();
  
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Aplica as regras de padronização
  const applyRules = useCallback((transactions: ImportedTransaction[], rules: StandardizationRule[]): ImportedTransaction[] => {
    return transactions.map(tx => {
      let updatedTx = { ...tx };
      const originalDesc = tx.originalDescription.toLowerCase();
      
      for (const rule of rules) {
        if (originalDesc.includes(rule.pattern.toLowerCase())) {
          updatedTx.categoryId = rule.categoryId;
          updatedTx.operationType = rule.operationType;
          updatedTx.description = rule.descriptionTemplate;
          
          if (rule.operationType === 'transferencia') {
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
  }, []);

  // Centralized file selection logic
  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
        const fileName = selectedFile.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.ofx')) {
            setError("Formato de arquivo inválido. Use .csv ou .ofx.");
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    handleFileSelect(selectedFile || null);
  };
  
  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || disabled) {
      setError("Selecione uma conta e um arquivo para importar.");
      return;
    }
    
    setLoading(true);
    onLoadingChange(true);
    setError(null);
    
    try {
      const content = await file.text();
      let rawTransactions: ImportedTransaction[] = [];
      
      if (content.toLowerCase().includes('<ofx>')) {
        rawTransactions = parseOFX(content, accountId);
      } else if (file.name.toLowerCase().endsWith('.csv') || content.includes('\t') || content.includes(',')) {
        rawTransactions = parseCSV(content, accountId);
      } else {
        setError("Formato de arquivo não reconhecido. Use .csv ou .ofx.");
        return;
      }
      
      if (rawTransactions.length === 0) {
        setError("Nenhuma transação válida encontrada no arquivo.");
        return;
      }
      
      // 1. Aplica as regras de padronização
      const processedTransactions = applyRules(rawTransactions, standardizationRules);
      
      // 2. Determina o período do extrato
      const dates = processedTransactions.map(t => parseDateLocal(t.date));
      const dateFrom = format(min(dates), 'yyyy-MM-dd');
      const dateTo = format(max(dates), 'yyyy-MM-dd');
      
      // 3. Cria o objeto Statement para o contexto
      const newStatement: Omit<ImportedStatement, "id" | "status"> = {
          accountId,
          fileName: file.name,
          dateFrom,
          dateTo,
          rawTransactions: processedTransactions,
      };
      
      onStatementAdded(newStatement);
      
      // Limpa o estado local
      setFile(null);
      
    } catch (e: any) {
      console.error("Parsing Error:", e);
      setError(e.message || "Erro ao processar o arquivo. Verifique o formato.");
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  };

  return (
    <div className="space-y-4">
      <div 
        className={cn(
            "p-6 border-2 border-dashed rounded-lg text-center space-y-3 transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className={cn("w-8 h-8 mx-auto", isDragging ? "text-primary" : "text-primary/70")} />
        <p className="text-sm font-medium">Arraste e solte ou clique para selecionar o arquivo</p>
        <Input 
          type="file" 
          accept=".csv,.ofx" 
          onChange={handleFileChange} 
          className="hidden" 
          id="file-upload-panel"
          disabled={disabled}
        />
        <Label htmlFor="file-upload-panel" className={cn(
            "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80",
            disabled && "pointer-events-none opacity-70"
        )}>
          {file ? file.name : "Selecionar Arquivo (.csv, .ofx)"}
        </Label>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      <Button 
        onClick={handleUpload} 
        disabled={!file || loading || disabled} 
        className="w-full bg-neon-gradient hover:opacity-90"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {loading ? "Processando..." : "Carregar Extrato"}
      </Button>
    </div>
  );
}