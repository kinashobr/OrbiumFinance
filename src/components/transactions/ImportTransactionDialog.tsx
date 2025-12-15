import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Check, X, Loader2 } from "lucide-react";
import { ContaCorrente, TransacaoCompleta, Categoria } from "@/types/finance";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";

interface ImportedTransaction {
  date: string;
  amount: number;
  originalDescription: string;
  // Campos para revisão
  accountId: string;
  categoryId: string | null;
  operationType: TransacaoCompleta['operationType'] | null;
  description: string; // Descrição padronizada ou original
  isTransfer: boolean;
  destinationAccountId: string | null;
}

interface ImportTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ContaCorrente;
}

export function ImportTransactionDialog({ open, onOpenChange, account }: ImportTransactionDialogProps) {
  const { categoriasV2, contasMovimento, addTransacaoV2 } = useFinance();
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [loading, setLoading] = useState(false);
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Placeholder para a função de parsing (será implementada na Fase 2)
  const parseFile = async (file: File, accountId: string): Promise<ImportedTransaction[]> => {
    // Simulação de parsing
    return new Promise((resolve) => {
      setTimeout(() => {
        const isCSV = file.name.toLowerCase().endsWith('.csv');
        const isOFX = file.name.toLowerCase().endsWith('.ofx');
        
        if (!isCSV && !isOFX) {
            setError("Formato de arquivo não suportado. Use .csv ou .ofx.");
            resolve([]);
            return;
        }
        
        // Dados simulados para teste
        const simulatedData: ImportedTransaction[] = [
          {
            date: '2024-07-15',
            amount: -150.00,
            originalDescription: 'STARBUCKS COFFEE SAO PAULO',
            accountId,
            categoryId: null,
            operationType: 'despesa',
            description: 'STARBUCKS COFFEE SAO PAULO',
            isTransfer: false,
            destinationAccountId: null,
          },
          {
            date: '2024-07-16',
            amount: 5000.00,
            originalDescription: 'SALARIO EMPRESA XYZ',
            accountId,
            categoryId: categoriasV2.find(c => c.label === 'Salário')?.id || null,
            operationType: 'receita',
            description: 'SALARIO EMPRESA XYZ',
            isTransfer: false,
            destinationAccountId: null,
          },
        ];
        
        resolve(simulatedData);
      }, 1000);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
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
      const transactions = await parseFile(file, account.id);
      
      if (transactions.length > 0) {
        setImportedTransactions(transactions);
        setStep('review');
      } else if (!error) {
        setError("Nenhuma transação válida encontrada no arquivo.");
      }
    } catch (e) {
      setError("Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleContabilizar = () => {
    // Lógica de contabilização será implementada na Fase 3
    toast.info("Contabilização em desenvolvimento (Fase 3)");
    onOpenChange(false);
  };

  const renderContent = () => {
    if (step === 'upload') {
      return (
        <div className="space-y-6">
          <div className="p-6 border-2 border-dashed border-border rounded-lg text-center space-y-3">
            <Upload className="w-8 h-8 mx-auto text-primary" />
            <p className="text-sm font-medium">Arraste e solte ou clique para selecionar o arquivo</p>
            <Input 
              type="file" 
              accept=".csv,.ofx" 
              onChange={handleFileChange} 
              className="hidden" 
              id="file-upload"
            />
            <Label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
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
            disabled={!file || loading} 
            className="w-full bg-neon-gradient hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {loading ? "Processando..." : "Carregar Transações"}
          </Button>
        </div>
      );
    }
    
    if (step === 'review') {
      return (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-sm font-medium text-primary">
              {importedTransactions.length} transações prontas para revisão.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Conta de Origem: {account.name}
            </p>
          </div>
          
          {/* Placeholder para a Tabela de Revisão (Fase 3) */}
          <div className="h-64 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
            Tabela de Revisão (Fase 3)
          </div>
          
          <Button 
            onClick={handleContabilizar} 
            className="w-full bg-success hover:bg-success/90"
          >
            Contabilizar Lançamentos
          </Button>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Importar Extrato - {account.name}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? "Carregue um arquivo CSV (Nubank) ou OFX para iniciar a conciliação."
              : "Revise e categorize as transações importadas antes de contabilizar."
            }
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}