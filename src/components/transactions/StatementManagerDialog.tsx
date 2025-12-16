import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Check, X, Loader2, AlertCircle, Pin, Car, Eye, Trash2 } from "lucide-react";
import { 
  ContaCorrente, ImportedStatement, ImportedTransaction, 
  formatCurrency, generateStatementId, AccountType
} from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { parseDateLocal, cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

// Interface simplificada para Empréstimo (agora passada via props)
interface LoanInfo {
  id: string;
  institution: string;
  numeroContrato?: string;
}

// Interface simplificada para Investimento (agora passada via props)
interface InvestmentInfo {
  id: string;
  name: string;
}

interface StatementManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ContaCorrente;
  investments: InvestmentInfo[];
  loans: LoanInfo[];
  onStartConsolidatedReview: (accountId: string) => void; // NEW PROP
}

export function StatementManagerDialog({ open, onOpenChange, account, investments, loans, onStartConsolidatedReview }: StatementManagerDialogProps) {
  const { 
    importedStatements, 
    processStatementFile, 
    deleteImportedStatement,
  } = useFinance();
  
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Filtra extratos pertencentes à conta atual
  const statementsForAccount = useMemo(() => {
    return importedStatements.filter(s => s.accountId === account.id);
  }, [importedStatements, account.id]);

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
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione um arquivo para importar.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await processStatementFile(file, account.id);
      
      if (result.success) {
        toast.success(result.message);
        setFile(null);
      } else {
        setError(result.message);
      }
      
    } catch (e: any) {
      console.error("Parsing Error:", e);
      setError(e.message || "Erro ao processar o arquivo. Verifique o formato.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteStatement = (statementId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este extrato? Todas as transações brutas não contabilizadas serão perdidas.")) {
        deleteImportedStatement(statementId);
        toast.success("Extrato excluído.");
    }
  };
  
  const handleStartReview = () => {
    if (statementsForAccount.length === 0) {
        toast.error("Importe pelo menos um extrato para iniciar a revisão.");
        return;
    }
    onOpenChange(false); // Fecha o gerenciador
    onStartConsolidatedReview(account.id); // Abre a tela de revisão consolidada
  };

  const renderContent = () => {
    return (
      <div className="space-y-6">
        {/* Upload Area */}
        <div 
          className={cn(
              "p-4 border-2 border-dashed rounded-lg text-center space-y-3 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={cn("w-6 h-6 mx-auto", isDragging ? "text-primary" : "text-primary/70")} />
          <Input 
            type="file" 
            accept=".csv,.ofx" 
            onChange={handleFileChange} 
            className="hidden" 
            id="file-upload"
          />
          <Label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-9 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {file ? file.name : "Selecionar Arquivo (.csv, .ofx)"}
          </Label>
          
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <X className="w-3 h-3" />
              {error}
            </div>
          )}
          
          <Button 
            onClick={handleUpload} 
            disabled={!file || loading} 
            className="w-full h-9 bg-primary hover:bg-primary/90 gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {loading ? "Processando..." : "Carregar Extrato"}
          </Button>
        </div>
        
        {/* Lista de Extratos Importados */}
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Extratos Importados ({statementsForAccount.length})</h3>
            
            <ScrollArea className="h-[30vh] max-h-[300px] border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Transações</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-16">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statementsForAccount.map(stmt => {
                            const pendingCount = stmt.rawTransactions.filter(t => !t.isContabilized).length;
                            const totalCount = stmt.rawTransactions.length;
                            const statusColor = stmt.status === 'complete' ? 'text-success' : stmt.status === 'partial' ? 'text-warning' : 'text-primary';
                            
                            return (
                                <TableRow key={stmt.id} className="hover:bg-muted/30">
                                    <TableCell className="text-sm font-medium max-w-[150px] truncate" title={stmt.fileName}>
                                        {stmt.fileName}
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                        {format(parseDateLocal(stmt.startDate), 'dd/MM/yy')} - {format(parseDateLocal(stmt.endDate), 'dd/MM/yy')}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {pendingCount} pendentes / {totalCount} total
                                    </TableCell>
                                    <TableCell>
                                        <span className={cn("text-xs font-medium", statusColor)}>
                                            {stmt.status === 'complete' ? 'Completo' : stmt.status === 'partial' ? 'Parcial' : 'Pendente'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteStatement(stmt.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {statementsForAccount.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    Nenhum extrato importado para esta conta.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        {/* Botão de Revisão Consolidada */}
        <Button 
            onClick={handleStartReview} 
            disabled={statementsForAccount.length === 0}
            className="w-full bg-accent hover:bg-accent/90 gap-2"
        >
            <Eye className="w-4 h-4" />
            Iniciar Revisão Consolidada
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Gerenciar Extratos - {account.name}
          </DialogTitle>
          <DialogDescription>
            Carregue múltiplos arquivos (.csv ou .ofx) para revisão consolidada.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6 pr-7">
            {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}