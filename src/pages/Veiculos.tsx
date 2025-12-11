import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, Car, Shield, AlertTriangle, DollarSign, FileText, Search, ArrowRight, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useFinance, Veiculo, SeguroVeiculo } from "@/contexts/FinanceContext";
import { EditableCell } from "@/components/EditableCell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FipeConsultaDialog } from "@/components/vehicles/FipeConsultaDialog";
import { TransacaoCompleta, generateTransactionId, OperationType, getFlowTypeFromOperation, getDomainFromOperation } from "@/types/finance";
import { useNavigate } from "react-router-dom";

const Veiculos = () => {
  const navigate = useNavigate();
  const { 
    veiculos, 
    addVeiculo, 
    updateVeiculo, 
    deleteVeiculo, 
    getCustoVeiculos,
    getPendingVehicles,
    segurosVeiculo,
    addSeguroVeiculo,
    updateSeguroVeiculo,
    deleteSeguroVeiculo,
    getValorFipeTotal,
    contasMovimento,
    categoriasV2,
    investimentosRF,
    emprestimos,
    addTransacaoV2,
    transacoesV2,
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState("veiculos");
  const [showAddVeiculo, setShowAddVeiculo] = useState(false);
  const [showAddSeguro, setShowAddSeguro] = useState(false);
  const [pendingVehicleId, setPendingVehicleId] = useState<number | null>(null);
  const [showFipeDialog, setShowFipeDialog] = useState(false);
  const [selectedVeiculoFipe, setSelectedVeiculoFipe] = useState<Veiculo | undefined>(undefined);
  
  // Estado para simular o pré-preenchimento do modal de movimentação
  const [parcelaToPay, setParcelaToPay] = useState<{
    seguroId: number;
    parcelaNumero: number;
    valor: number;
    veiculoNome: string;
    vencimento: string;
  } | null>(null);
  
  // Forms
  const [formData, setFormData] = useState({
    modelo: "",
    marca: "",
    tipo: "carro" as 'carro' | 'moto' | 'caminhao',
    ano: "",
    dataCompra: "",
    valorVeiculo: "",
    valorFipe: "",
  });

  const [formSeguro, setFormSeguro] = useState({
    veiculoId: "",
    numeroApolice: "",
    seguradora: "",
    vigenciaInicio: "",
    vigenciaFim: "",
    valorTotal: "",
    numeroParcelas: "",
    meiaParcela: false,
  });

  const handleOpenFipeConsulta = (veiculo?: Veiculo) => {
    setSelectedVeiculoFipe(veiculo);
    setShowFipeDialog(true);
  };
  
  const handleUpdateFipe = (veiculoId: number, valorFipe: number) => {
    updateVeiculo(veiculoId, { valorFipe });
    toast.success("Valor FIPE atualizado!");
  };
  
  const handleSubmitVeiculo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.modelo || !formData.ano || !formData.dataCompra || !formData.valorVeiculo) return;
    
    if (pendingVehicleId) {
      updateVeiculo(pendingVehicleId, {
        modelo: formData.modelo,
        marca: formData.marca,
        tipo: formData.tipo,
        ano: Number(formData.ano),
        valorFipe: Number(formData.valorFipe) || Number(formData.valorVeiculo),
        status: 'ativo',
      });
      setPendingVehicleId(null);
    } else {
      addVeiculo({
        modelo: formData.modelo,
        marca: formData.marca,
        tipo: formData.tipo,
        ano: Number(formData.ano),
        dataCompra: formData.dataCompra,
        valorVeiculo: Number(formData.valorVeiculo),
        valorSeguro: 0,
        vencimentoSeguro: "",
        parcelaSeguro: 0,
        valorFipe: Number(formData.valorFipe) || Number(formData.valorVeiculo),
        status: 'ativo',
      });
    }
    
    setFormData({ modelo: "", marca: "", tipo: "carro", ano: "", dataCompra: "", valorVeiculo: "", valorFipe: "" });
    setShowAddVeiculo(false);
    toast.success(pendingVehicleId ? "Veículo configurado!" : "Veículo adicionado!");
  };

  const handleSubmitSeguro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSeguro.veiculoId || !formSeguro.numeroApolice || !formSeguro.seguradora || 
        !formSeguro.vigenciaInicio || !formSeguro.vigenciaFim || !formSeguro.valorTotal || 
        !formSeguro.numeroParcelas) return;
    
    const numParcelas = Number(formSeguro.numeroParcelas);
    const valorTotal = Number(formSeguro.valorTotal);
    const valorParcela = valorTotal / numParcelas;
    
    // Generate installment dates
    const parcelas = [];
    const dataInicio = new Date(formSeguro.vigenciaInicio);
    
    for (let i = 0; i < numParcelas; i++) {
      const dataVencimento = new Date(dataInicio);
      dataVencimento.setMonth(dataVencimento.getMonth() + i);
      
      parcelas.push({
        numero: i + 1,
        vencimento: dataVencimento.toISOStringAssistant: First, the user reported one TypeScript error: Cannot find name 'RefreshCw' in src/pages/Veiculos.tsx at line 823.

The fix is to add `RefreshCw` to the existing import from "lucide-react".

The existing import is:

import { Plus, Trash2, Car, Shield, AlertTriangle, DollarSign, FileText, Search, ArrowRight, CheckCircle2, Clock } from "lucide-react";

I need to add RefreshCw to it: ... Clock, RefreshCw } from "lucide-react";

The guidelines say: "Always reply to the user in the same language they are using." The user is using English, so OK.

Before proceeding: Check if already implemented. It's not, there's an error.

Briefly explain: "To fix the TypeScript error, I'll add the missing RefreshCw icon to the existing Lucide React import statement."

Then use ONE <dyad-write> block for the entire file, since it's the only file to change.

Provide a VERY CONCISE, non-technical summary: "Added missing RefreshCw icon import to fix TypeScript error."

End with <dyad-chat-summary> something like "Fixed RefreshCw TypeScript error"</dyad-chat-summary>

Important: Write the ENTIRE file in the <dyad-write>, as per "ALWAYS write the entire file. It needs to be a complete file."

The previous response was cut off, but I need to output the full corrected file.

In the human's message, the file is provided fully, so I can copy it and just modify the import line.

Find the line around 823: In the code, in the parcelas tab, there's:

<Button
  variant="ghost"
  size="icon"
  onClick={() => { /* Opção de estornar */ }}
  className="h-8 w-8 text-muted-foreground"
  title="Estornar pagamento"
>
  <RefreshCw className="w-4 h-4" />
</Button>

Yes, that's the spot. But since RefreshCw wasn't imported, adding to import fixes it.

No other changes needed.

No new dependencies or anything.

The file has some unused imports like FileText, but don't touch unless requested.

In the parcelas table, there's no import for RefreshCw, yes.

Also, note there's a comment /* Opção de estornar */ which is Portuguese for "Reverse payment option", but leave it.

Output structure:

- Brief explanation.

- <dyad-write path="src/pages/Veiculos.tsx" description="..."> full code