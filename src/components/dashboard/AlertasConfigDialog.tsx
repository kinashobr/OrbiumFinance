import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  Target,
  Save,
  CreditCard,
  Repeat,
  Shield,
  Settings2,
  Car,
  DollarSign,
  Percent,
} from "lucide-react";

interface AlertaConfig {
  id: string;
  nome: string;
  ativo: boolean;
  tolerancia: number;
}

interface AlertasConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AlertaConfig[];
  onSave: (config: AlertaConfig[]) => void;
}

const ALERTA_INFO: Record<string, { icon: React.ElementType; descricao: string; unidade: string }> = {
  "saldo-negativo": {
    icon: AlertTriangle,
    descricao: "Alerta quando o saldo total das contas ficar negativo",
    unidade: "R$"
  },
  "emprestimos-pendentes": {
    icon: Settings2,
    descricao: "Alerta sobre empréstimos aguardando configuração",
    unidade: ""
  },
  "veiculos-pendentes": {
    icon: Car,
    descricao: "Alerta sobre veículos comprados aguardando cadastro completo",
    unidade: ""
  },
  "parcela-emprestimo-vencida": {
    icon: CreditCard,
    descricao: "Alerta se houver parcela de empréstimo em atraso",
    unidade: ""
  },
  "seguro-vencendo": {
    icon: Shield,
    descricao: "Alerta quando seguros de veículos estão próximos do vencimento",
    unidade: "dias"
  },
  "comprometimento-renda": {
    icon: Percent,
    descricao: "Alerta quando parcelas de empréstimo e despesas fixas ultrapassam X% da receita",
    unidade: "%"
  },
  "margem-baixa": {
    icon: DollarSign,
    descricao: "Alerta quando a margem de poupança (Resultado Líquido / Receita) ficar abaixo de X%",
    unidade: "%"
  },
};

const DEFAULT_CONFIG: AlertaConfig[] = [
  { id: "saldo-negativo", nome: "Risco de Descoberto", ativo: true, tolerancia: 0 },
  { id: "emprestimos-pendentes", nome: "Configuração de Empréstimo", ativo: true, tolerancia: 0 },
  { id: "veiculos-pendentes", nome: "Cadastro de Veículo Pendente", ativo: true, tolerancia: 0 },
  { id: "parcela-emprestimo-vencida", nome: "Parcela de Empréstimo Vencida", ativo: true, tolerancia: 0 },
  { id: "seguro-vencendo", nome: "Seguro Próximo ao Vencimento", ativo: true, tolerancia: 30 },
  { id: "comprometimento-renda", nome: "Comprometimento de Renda", ativo: true, tolerancia: 30 },
  { id: "margem-baixa", nome: "Margem de Poupança Baixa", ativo: true, tolerancia: 10 },
];


export function AlertasConfigDialog({ open, onOpenChange, config, onSave }: AlertasConfigDialogProps) {
  const [localConfig, setLocalConfig] = useState<AlertaConfig[]>(config);

  useEffect(() => {
    // Sincroniza a configuração local com a prop 'config' quando o diálogo abre
    setLocalConfig(config);
  }, [config]);

  const handleToggle = (id: string) => {
    setLocalConfig(prev =>
      prev.map(c => (c.id === id ? { ...c, ativo: !c.ativo } : c))
    );
  };

  const handleToleranciaChange = (id: string, value: string) => {
    const info = ALERTA_INFO[id];
    let numValue = parseFloat(value.replace(',', '.')) || 0;
    
    // Se for R$, permite valores negativos
    if (info?.unidade === 'R$') {
        // Mantém o valor como está
    } else {
        // Para percentual ou dias, garante que seja positivo
        numValue = Math.max(0, numValue);
    }

    setLocalConfig(prev =>
      prev.map(c => (c.id === id ? { ...c, tolerancia: numValue } : c))
    );
  };

  const handleSave = () => {
    onSave(localConfig);
    onOpenChange(false);
  };

  const handleReset = () => {
    // Recarrega a configuração padrão (ou a última salva)
    const configMap = new Map(config.map((c: AlertaConfig) => [c.id, c]));
    const resetConfig = DEFAULT_CONFIG.map(defaultAlert => {
        if (configMap.has(defaultAlert.id)) {
            return { ...defaultAlert, ...configMap.get(defaultAlert.id)! };
        }
        return defaultAlert;
    });
    setLocalConfig(resetConfig);
  };
  
  const formatTolerancia = (value: number, unidade: string) => {
      if (unidade === 'R$') {
          return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return value.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Configurar Alertas
          </DialogTitle>
          <DialogDescription>
            Personalize quais alertas deseja receber e seus limites
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {localConfig.map((alerta, index) => {
            const info = ALERTA_INFO[alerta.id];
            if (!info) return null; // Skip removed/unknown alerts
            
            const Icon = info.icon;

            return (
              <div key={alerta.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Label className="font-medium">{alerta.nome}</Label>
                        <p className="text-xs text-muted-foreground">
                          {info.descricao}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={alerta.ativo}
                      onCheckedChange={() => handleToggle(alerta.id)}
                    />
                  </div>

                  {alerta.ativo && info.unidade && (
                    <div className="flex items-center gap-2 pl-11">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Limite:
                      </Label>
                      <div className="relative flex-1 max-w-24">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={formatTolerancia(alerta.tolerancia, info.unidade)}
                          onChange={(e) => handleToleranciaChange(alerta.id, e.target.value)}
                          className="h-8 text-sm pr-8"
                        />
                        {info.unidade && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {info.unidade}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Resetar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}