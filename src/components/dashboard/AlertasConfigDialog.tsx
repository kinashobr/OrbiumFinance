"use client";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Target,
  Save,
  CreditCard,
  Repeat,
  Shield,
  Calendar,
  Bell,
  Zap,
  TrendingDown,
  PiggyBank,
  ShoppingCart,
  ArrowRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface AlertaConfig {
  id: string;
  nome: string;
  ativo: boolean;
  tolerancia: number;
  notificarDispositivo: boolean;
}

interface AlertasConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AlertaConfig[];
  onSave: (config: AlertaConfig[]) => void;
  initialStartDate: string;
  onStartDateChange: (date: string) => void;
}

const ALERTA_INFO: Record<string, { icon: any; color: string; descricao: string; unidade: string; min: number; max: number }> = {
  "saldo-negativo": {
    icon: AlertTriangle,
    color: "text-destructive",
    descricao: "Alerta quando o saldo de liquidez imediata ficar abaixo de zero.",
    unidade: "R$",
    min: -10000,
    max: 0
  },
  "dividas-altas": {
    icon: Scale,
    color: "text-orange-500",
    descricao: "Alerta quando o total de dívidas ultrapassar X% do seu patrimônio líquido.",
    unidade: "%",
    min: 10,
    max: 500
  },
  "margem-baixa": {
    icon: Target,
    color: "text-primary",
    descricao: "Alerta quando a margem de poupança mensal (sobra) for menor que X%.",
    unidade: "%",
    min: 0,
    max: 50
  },
  "comprometimento-renda": {
    icon: CreditCard,
    color: "text-destructive",
    descricao: "Alerta quando as parcelas de empréstimos somarem mais de X% da sua renda.",
    unidade: "%",
    min: 5,
    max: 100
  },
  "rigidez-orcamentaria": {
    icon: Repeat,
    color: "text-warning",
    descricao: "Alerta quando seus custos fixos consumirem mais de X% das despesas totais.",
    unidade: "%",
    min: 20,
    max: 90
  },
  "reserva-insuficiente": {
    icon: PiggyBank,
    color: "text-indigo-500",
    descricao: "Alerta quando sua reserva de emergência estiver abaixo de X meses de custo fixo.",
    unidade: "meses",
    min: 1,
    max: 24
  },
  "seguro-vencendo": {
    icon: Shield,
    color: "text-blue-500",
    descricao: "Alerta antecipado para renovação de seguros de veículos (60 dias).",
    unidade: "dias",
    min: 15,
    max: 90
  },
  "gasto-categoria": {
    icon: ShoppingCart,
    color: "text-pink-500",
    descricao: "Alerta quando uma única categoria de despesa variar mais de X% vs mês anterior.",
    unidade: "%",
    min: 5,
    max: 200
  }
};

import { Scale } from "lucide-react";

export function AlertasConfigDialog({ 
  open, 
  onOpenChange, 
  config, 
  onSave,
  initialStartDate,
  onStartDateChange
}: AlertasConfigDialogProps) {
  const [localConfig, setLocalConfig] = useState<AlertaConfig[]>(config);
  const [startDate, setStartDate] = useState(initialStartDate);

  useEffect(() => {
    if (open) {
      setLocalConfig(config);
      setStartDate(initialStartDate);
    }
  }, [open, config, initialStartDate]);

  const handleToggle = (id: string) => {
    setLocalConfig(prev =>
      prev.map(c => (c.id === id ? { ...c, ativo: !c.ativo } : c))
    );
  };

  const handleDeviceNotifyToggle = (id: string) => {
    setLocalConfig(prev =>
      prev.map(c => (c.id === id ? { ...c, notificarDispositivo: !c.notificarDispositivo } : c))
    );
  };

  const handleToleranciaChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalConfig(prev =>
      prev.map(c => (c.id === id ? { ...c, tolerancia: numValue } : c))
    );
  };

  const handleSave = () => {
    onSave(localConfig);
    onStartDateChange(startDate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,40rem)] h-[min(90vh,850px)] p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl flex flex-col bg-background">
        <DialogHeader className="px-8 pt-10 pb-6 bg-primary/5 shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <DialogTitle className="text-3xl font-black tracking-tighter">Central de Alertas</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground flex items-center gap-2 mt-1 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-accent" />
                Inteligência de Monitoramento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-8 py-6">
          <div className="space-y-8 pb-10">
            {/* Configuração de Data de Corte */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-background text-primary shadow-sm">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <Label className="font-black text-sm uppercase tracking-widest">Data de Início da Análise</Label>
                    <p className="text-[10px] text-muted-foreground font-medium">Define o ponto zero para cálculos de desempenho</p>
                  </div>
                </div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 h-10 rounded-xl border-2 font-bold text-xs"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Gatilhos Inteligentes</h3>
                <Badge variant="outline" className="rounded-lg border-none bg-primary/10 text-primary font-black text-[10px]">
                  {localConfig.filter(c => c.ativo).length} ATIVOS
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {localConfig.map((alerta) => {
                  const info = ALERTA_INFO[alerta.id];
                  const Icon = info?.icon || Target;

                  return (
                    <div 
                      key={alerta.id}
                      className={cn(
                        "p-5 rounded-[2rem] border-2 transition-all duration-300",
                        alerta.ativo ? "bg-card border-primary/20 shadow-md" : "bg-muted/20 border-transparent opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform",
                            alerta.ativo ? "bg-muted shadow-inner" : "bg-muted/50"
                          )}>
                            <Icon className={cn("w-6 h-6", alerta.ativo ? info?.color : "text-muted-foreground")} />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="font-black text-sm text-foreground">{alerta.nome}</Label>
                            <p className="text-[11px] font-medium text-muted-foreground leading-tight max-w-[280px]">
                              {info?.descricao}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={alerta.ativo}
                          onCheckedChange={() => handleToggle(alerta.id)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>

                      {alerta.ativo && (
                        <div className="mt-6 pt-5 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limite de Alerta:</Label>
                            <div className="relative w-32">
                              <Input
                                type="number"
                                value={alerta.tolerancia}
                                onChange={(e) => handleToleranciaChange(alerta.id, e.target.value)}
                                className="h-9 rounded-xl border-2 font-black text-sm pr-8"
                                min={info?.min}
                                max={info?.max}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">
                                {info?.unidade}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-2xl">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notificar no Celular</Label>
                            <Switch
                              checked={alerta.notificarDispositivo}
                              onCheckedChange={() => handleDeviceNotifyToggle(alerta.id)}
                              size="sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-surface-light dark:bg-surface-dark border-t flex gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full h-12 px-8 font-bold text-muted-foreground">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1 rounded-full h-12 bg-primary text-primary-foreground font-black text-sm gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Save className="w-5 h-5" />
            SALVAR CONFIGURAÇÕES
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}