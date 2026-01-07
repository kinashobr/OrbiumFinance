import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Car, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { 
  buscarMarcas, 
  buscarModelos, 
  buscarAnos, 
  buscarValorFipe,
  tipoToFipe,
  FipeMarca,
  FipeModelo,
  FipeAno,
  FipeResult 
} from "@/services/fipeService";
import { Veiculo } from "@/types/finance";
import { cn } from "@/lib/utils";

interface FipeConsultaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo?: Veiculo;
  onUpdateFipe?: (veiculoId: number, valorFipe: number) => void;
}

// Helper para normalizar strings para comparação
const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function FipeConsultaDialog({ open, onOpenChange, veiculo, onUpdateFipe }: FipeConsultaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'result'>('select');
  const [error, setError] = useState<string | null>(null);
  
  // Selection states
  const [tipo, setTipo] = useState<'carros' | 'motos' | 'caminhoes'>('carros');
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  
  const [selectedMarca, setSelectedMarca] = useState<string>('');
  const [selectedModelo, setSelectedModelo] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');
  
  const [resultado, setResultado] = useState<FipeResult | null>(null);
  const [valorNumerico, setValorNumerico] = useState<number>(0);

  // --- Loading Callbacks ---

  const loadMarcas = useCallback(async (tipoVeiculo: 'carros' | 'motos' | 'caminhoes') => {
    setLoading(true);
    setError(null);
    try {
      const data = await buscarMarcas(tipoVeiculo);
      setMarcas(data);
      setModelos([]);
      setAnos([]);
      setSelectedModelo('');
      setSelectedAno('');
      return data;
    } catch (err) {
      setError('Erro ao carregar marcas');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadModelos = useCallback(async (tipoVeiculo: 'carros' | 'motos' | 'caminhoes', codigoMarca: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await buscarModelos(tipoVeiculo, codigoMarca);
      setModelos(data.modelos);
      setAnos([]);
      setSelectedAno('');
      return data.modelos;
    } catch (err) {
      setError('Erro ao carregar modelos');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadAnos = useCallback(async (tipoVeiculo: 'carros' | 'motos' | 'caminhoes', codigoMarca: string, codigoModelo: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await buscarAnos(tipoVeiculo, codigoMarca, codigoModelo);
      setAnos(data);
      return data;
    } catch (err) {
      setError('Erro ao carregar anos');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Pre-fill Logic ---

  useEffect(() => {
    if (!open) {
      // Reset state when closing
      setStep('select');
      setError(null);
      setResultado(null);
      setValorNumerico(0);
      setSelectedMarca('');
      setSelectedModelo('');
      setSelectedAno('');
      setMarcas([]);
      setModelos([]);
      setAnos([]);
      setTipo('carros');
      return;
    }

    if (veiculo && veiculo.marca && veiculo.modelo && veiculo.ano) {
      const preFill = async () => {
        setLoading(true);
        setStep('select');
        setError(null);
        
        try {
          const fipeTipo = tipoToFipe(veiculo.tipo || 'carro');
          setTipo(fipeTipo);
          
          // 1. Buscar e Selecionar Marca
          const marcaData = await loadMarcas(fipeTipo);
          const normalizedMarca = normalizeString(veiculo.marca!);
          // Tenta encontrar a marca que contenha o nome cadastrado
          const matchingMarca = marcaData.find(m => normalizeString(m.nome).includes(normalizedMarca));
          
          if (!matchingMarca) {
            setError(`Marca "${veiculo.marca}" não encontrada na FIPE.`);
            return;
          }
          
          setSelectedMarca(matchingMarca.codigo);
          
          // 2. Buscar e Selecionar Modelo
          const modelosData = await loadModelos(fipeTipo, matchingMarca.codigo);
          const normalizedModelo = normalizeString(veiculo.modelo!);
          // Tenta encontrar o modelo que contenha o nome cadastrado
          const matchingModelo = modelosData.find(m => normalizeString(m.nome).includes(normalizedModelo));
          
          if (!matchingModelo) {
            setError(`Modelo "${veiculo.modelo}" não encontrado na FIPE.`);
            return;
          }
          
          const modeloCodigo = matchingModelo.codigo.toString();
          setSelectedModelo(modeloCodigo);
          
          // 3. Buscar e Selecionar Ano
          const anosData = await loadAnos(fipeTipo, matchingMarca.codigo, modeloCodigo);
          // Tenta encontrar o ano que contenha o ano cadastrado (ex: "2020 Gasolina")
          const matchingAno = anosData.find(a => a.nome.includes(veiculo.ano.toString()));
          
          if (!matchingAno) {
            setError(`Ano "${veiculo.ano}" não encontrado na FIPE.`);
            return;
          }
          
          setSelectedAno(matchingAno.codigo);
          
        } catch (err) {
          console.error(err);
          setError('Erro ao pré-preencher dados FIPE.');
        } finally {
          setLoading(false);
        }
      };
      
      preFill();
    } else if (open) {
      // If opening without a vehicle or incomplete data, just load initial brands
      loadMarcas(tipo);
    }
  }, [open, veiculo, loadMarcas, loadModelos, loadAnos]);

  // --- Handlers for User Interaction ---

  const handleTipoChange = (novoTipo: 'carros' | 'motos' | 'caminhoes') => {
    setTipo(novoTipo);
    setSelectedMarca('');
    setSelectedModelo('');
    setSelectedAno('');
    loadMarcas(novoTipo);
  };
  
  const handleMarcaChange = (codigo: string) => {
    setSelectedMarca(codigo);
    setSelectedModelo('');
    setSelectedAno('');
    loadModelos(tipo, codigo);
  };
  
  const handleModeloChange = (codigo: string) => {
    setSelectedModelo(codigo);
    setSelectedAno('');
    loadAnos(tipo, selectedMarca, codigo);
  };
  
  const consultarFipe = async () => {
    if (!selectedMarca || !selectedModelo || !selectedAno) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await buscarValorFipe(tipo, selectedMarca, selectedModelo, selectedAno);
      setResultado(data);
      
      const valor = parseFloat(
        data.Valor
          .replace('R$ ', '')
          .replace(/\./g, '')
          .replace(',', '.')
      );
      setValorNumerico(valor);
      setStep('result');
    } catch (err) {
      setError('Erro ao consultar valor FIPE');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAplicarValor = () => {
    if (veiculo && onUpdateFipe && valorNumerico > 0) {
      onUpdateFipe(veiculo.id, valorNumerico);
      onOpenChange(false);
    }
  };
  
  const handleReset = () => {
    setStep('select');
    setResultado(null);
    setValorNumerico(0);
    // Reload marcas to reset selection
    loadMarcas(tipo);
  };
  
  // Calculate difference with vehicle purchase price
  const getDiferenca = () => {
    if (!veiculo || !valorNumerico) return null;
    const diff = valorNumerico - veiculo.valorVeiculo;
    const percent = (diff / veiculo.valorVeiculo) * 100;
    return { diff, percent };
  };
  
  const diferenca = getDiferenca();
  
  const isConsultable = selectedMarca && selectedModelo && selectedAno;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,32rem)] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Consulta FIPE
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {step === 'select' && (
          <div className="space-y-4">
            {veiculo && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">Veículo selecionado:</p>
                <p className="font-medium">{veiculo.marca} {veiculo.modelo} ({veiculo.ano})</p>
              </div>
            )}
            
            <div>
              <Label>Tipo de Veículo</Label>
              <Select value={tipo} onValueChange={handleTipoChange} disabled={loading}>
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carros">Carro</SelectItem>
                  <SelectItem value="motos">Moto</SelectItem>
                  <SelectItem value="caminhoes">Caminhão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Marca</Label>
              <Select 
                value={selectedMarca} 
                onValueChange={handleMarcaChange}
                disabled={marcas.length === 0 || loading}
              >
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue placeholder={loading ? "Carregando..." : "Selecione a marca"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {marcas.map(m => (
                    <SelectItem key={m.codigo} value={m.codigo}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Modelo</Label>
              <Select 
                value={selectedModelo} 
                onValueChange={handleModeloChange}
                disabled={modelos.length === 0 || loading}
              >
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue placeholder={loading ? "Carregando..." : "Selecione o modelo"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {modelos.map(m => (
                    <SelectItem key={m.codigo} value={m.codigo.toString()}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Ano</Label>
              <Select 
                value={selectedAno} 
                onValueChange={setSelectedAno}
                disabled={anos.length === 0 || loading}
              >
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue placeholder={loading ? "Carregando..." : "Selecione o ano"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {anos.map(a => (
                    <SelectItem key={a.codigo} value={a.codigo}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={consultarFipe} 
              disabled={!isConsultable || loading}
              className="w-full bg-neon-gradient hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Consultar FIPE
                </>
              )}
            </Button>
          </div>
        )}
        
        {step === 'result' && resultado && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-5 h-5 text-primary" />
                <span className="font-semibold">{resultado.Marca} {resultado.Modelo}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Ano:</span>
                  <p className="font-medium">{resultado.AnoModelo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Combustível:</span>
                  <p className="font-medium">{resultado.Combustivel}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Código FIPE:</span>
                  <p className="font-medium">{resultado.CodigoFipe}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Referência:</span>
                  <p className="font-medium">{resultado.MesReferencia}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-primary/20">
                <span className="text-muted-foreground text-sm">Valor FIPE:</span>
                <p className="text-2xl font-bold text-primary">{resultado.Valor}</p>
              </div>
            </div>
            
            {diferenca && (
              <div className={cn(
                "p-3 rounded-lg border flex items-center justify-between",
                diferenca.diff > 0 
                  ? "bg-success/10 border-success/20" 
                  : diferenca.diff < 0 
                    ? "bg-destructive/10 border-destructive/20"
                    : "bg-muted border-border"
              )}>
                <div className="flex items-center gap-2">
                  {diferenca.diff > 0 ? (
                    <TrendingUp className="w-4 h-4 text-success" />
                  ) : diferenca.diff < 0 ? (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {diferenca.diff > 0 ? 'Valorização' : diferenca.diff < 0 ? 'Desvalorização' : 'Igual'}
                  </span>
                </div>
                <Badge variant={diferenca.diff >= 0 ? "default" : "destructive"}>
                  {diferenca.diff >= 0 ? '+' : ''}
                  {diferenca.percent.toFixed(1)}%
                </Badge>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Nova Consulta
              </Button>
              {veiculo && onUpdateFipe && (
                <Button onClick={handleAplicarValor} className="flex-1 bg-neon-gradient hover:opacity-90">
                  Aplicar Valor
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}