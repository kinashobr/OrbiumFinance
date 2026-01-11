import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Bell, 
  TrendingDown, 
  CreditCard, 
  Target,
  Settings2,
  ChevronRight,
  X,
  Repeat,
  Shield,
  PiggyBank,
  ShoppingCart,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { cn, parseDateLocal } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { AlertasConfigDialog, AlertaConfig } from "./AlertasConfigDialog";
import { isAfter, isSameDay, startOfDay, subMonths, isSameMonth } from "date-fns";

interface Alerta {
  id: string;
  tipo: "warning" | "danger" | "info" | "success";
  titulo: string;
  descricao: string;
  rota?: string;
  state?: any;
}

const ALERTA_ICONS: Record<string, any> = {
  "saldo-negativo": AlertTriangle,
  "dividas-altas": Scale,
  "margem-baixa": Target,
  "comprometimento-renda": CreditCard,
  "rigidez-orcamentaria": Repeat,
  "reserva-insuficiente": PiggyBank,
  "seguro-vencendo": Shield,
  "gasto-categoria": ShoppingCart
};

const DEFAULT_CONFIG: AlertaConfig[] = [
  { id: "saldo-negativo", nome: "Saldo Negativo", ativo: true, tolerancia: 0, notificarDispositivo: true },
  { id: "dividas-altas", nome: "Dívidas Altas", ativo: true, tolerancia: 40, notificarDispositivo: false },
  { id: "margem-baixa", nome: "Margem Baixa", ativo: true, tolerancia: 15, notificarDispositivo: true },
  { id: "comprometimento-renda", nome: "Comprometimento Renda", ativo: true, tolerancia: 30, notificarDispositivo: true },
  { id: "rigidez-orcamentaria", nome: "Rigidez Orçamentária", ativo: true, tolerancia: 60, notificarDispositivo: false },
  { id: "reserva-insuficiente", nome: "Reserva Insuficiente", ativo: true, tolerancia: 6, notificarDispositivo: true },
  { id: "seguro-vencendo", nome: "Seguro Vencendo", ativo: true, tolerancia: 60, notificarDispositivo: false },
  { id: "gasto-categoria", nome: "Variação de Gastos", ativo: true, tolerancia: 30, notificarDispositivo: false },
];

export function SidebarAlertas({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const { 
    transacoesV2, 
    emprestimos, 
    segurosVeiculo,
    categoriasV2,
    contasMovimento,
    getSaldoDevedor,
    alertStartDate, 
    setAlertStartDate, 
    calculateBalanceUpToDate,
    getAtivosTotal,
    getPatrimonioLiquido
  } = useFinance();
  
  const [configOpen, setConfigOpen] = useState(false);
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>(() => {
    const saved = localStorage.getItem("alertas-config-v2");
    if (saved) return JSON.parse(saved);
    return DEFAULT_CONFIG;
  });
  const [dismissedAlertas, setDismissedAlertas] = useState<Set<string>>(new Set());

  const metricas = useMemo(() => {
    const now = new Date();
    const parsedStart = startOfDay(parseDateLocal(alertStartDate));

    // 1. Liquidez Imediata
    const contasLiquidez = contasMovimento.filter(c => 
        ['corrente', 'poupanca', 'reserva', 'renda_fixa'].includes(c.accountType)
    );
    const saldoLiquidez = contasLiquidez.reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, now, transacoesV2, contasMovimento), 0);
    
    // 2. Patrimônio e Dívida
    const pl = getPatrimonioLiquido(now);
    const dividaTotal = getSaldoDevedor(now);
    const debtToEquity = pl > 0 ? (dividaTotal / pl) * 100 : 0;

    // 3. Fluxo (Período de Análise)
    const txsPeriodo = transacoesV2.filter(t => {
        const d = parseDateLocal(t.date);
        return isAfter(d, parsedStart) || isSameDay(d, parsedStart);
    });

    const receitas = txsPeriodo.filter(t => t.operationType === "receita" || t.operationType === "rendimento").reduce((a, t) => a + t.amount, 0);
    const despesas = txsPeriodo.filter(t => t.flow === "out").reduce((a, t) => a + t.amount, 0);
    const margemPoupanca = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

    // 4. Rigidez e Comprometimento
    const fixas = txsPeriodo.filter(t => categoriasV2.find(c => c.id === t.categoryId)?.nature === 'despesa_fixa').reduce((a, t) => a + t.amount, 0);
    const parcelas = txsPeriodo.filter(t => t.operationType === 'pagamento_emprestimo').reduce((a, t) => a + t.amount, 0);

    // 5. Reserva de Emergência (Meses de Cobertura)
    const reservaValor = contasMovimento.filter(c => c.accountType === 'reserva').reduce((acc, c) => acc + calculateBalanceUpToDate(c.id, now, transacoesV2, contasMovimento), 0);
    const custoFixoMensal = fixas / (Math.max(1, differenceInMonths(now, parsedStart) + 1));
    const mesesReserva = custoFixoMensal > 0 ? reservaValor / custoFixoMensal : 0;

    // 6. Variação de Categoria (Mês Atual vs Anterior)
    const lastMonth = subMonths(now, 1);
    const txsThisMonth = transacoesV2.filter(t => isSameMonth(parseDateLocal(t.date), now));
    const txsLastMonth = transacoesV2.filter(t => isSameMonth(parseDateLocal(t.date), lastMonth));
    
    let maiorVariacaoCat = 0;
    categoriasV2.forEach(cat => {
        const v1 = txsThisMonth.filter(t => t.categoryId === cat.id).reduce((a, t) => a + t.amount, 0);
        const v2 = txsLastMonth.filter(t => t.categoryId === cat.id).reduce((a, t) => a + t.amount, 0);
        if (v2 > 100) {
            const variacao = ((v1 - v2) / v2) * 100;
            if (variacao > maiorVariacaoCat) maiorVariacaoCat = variacao;
        }
    });

    return {
      saldoLiquidez, debtToEquity, margemPoupanca, fixas, despesas, receitas, parcelas, mesesReserva, maiorVariacaoCat
    };
  }, [transacoesV2, contasMovimento, categoriasV2, alertStartDate, calculateBalanceUpToDate, getPatrimonioLiquido, getSaldoDevedor]);

  const alertas = useMemo(() => {
    const alerts: Alerta[] = [];
    const configMap = new Map(alertasConfig.map(c => [c.id, c]));

    const check = (id: string, condition: boolean, titulo: string, desc: string, tipo: Alerta["tipo"], rota: string) => {
        if (configMap.get(id)?.ativo && condition) {
            alerts.push({ id, tipo, titulo, descricao: desc, rota });
        }
    };

    check("saldo-negativo", metricas.saldoLiquidez < configMap.get("saldo-negativo")!.tolerancia, "Saldo Negativo", `Disponível: R$ ${metricas.saldoLiquidez.toLocaleString('pt-BR')}`, "danger", "/receitas-despesas");
    check("dividas-altas", metricas.debtToEquity > configMap.get("dividas-altas")!.tolerancia, "Dívidas Elevadas", `${metricas.debtToEquity.toFixed(1)}% do PL`, "warning", "/emprestimos");
    check("margem-baixa", metricas.receitas > 0 && metricas.margemPoupanca < configMap.get("margem-baixa")!.tolerancia, "Margem Baixa", `${metricas.margemPoupanca.toFixed(1)}% de poupança`, "warning", "/receitas-despesas");
    check("comprometimento-renda", metricas.receitas > 0 && (metricas.parcelas / metricas.receitas * 100) > configMap.get("comprometimento-renda")!.tolerancia, "Renda Comprometida", `${(metricas.parcelas / metricas.receitas * 100).toFixed(1)}% em parcelas`, "danger", "/emprestimos");
    check("reserva-insuficiente", metricas.mesesReserva < configMap.get("reserva-insuficiente")!.tolerancia, "Reserva Baixa", `Cobre ${metricas.mesesReserva.toFixed(1)} meses`, "info", "/investimentos");
    check("gasto-categoria", metricas.maiorVariacaoCat > configMap.get("gasto-categoria")!.tolerancia, "Gasto Atípico", `Categoria subiu ${metricas.maiorVariacaoCat.toFixed(0)}%`, "warning", "/relatorios");

    return alerts.filter(a => !dismissedAlertas.has(a.id));
  }, [metricas, alertasConfig, dismissedAlertas]);

  const handleSaveConfig = (newConfig: AlertaConfig[]) => {
    setAlertasConfig(newConfig);
    localStorage.setItem("alertas-config-v2", JSON.stringify(newConfig));
    toast.success("Configurações de alerta salvas!");
  };

  return (
    <div className="px-2">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-foreground">Alertas</p>
          {alertas.length > 0 && (
            <Badge variant="destructive" className="h-5 px-2 text-[10px] font-black rounded-full">
              {alertas.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => setConfigOpen(true)}>
          <Settings2 className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <ScrollArea className="max-h-64">
        <div className="space-y-2.5 pb-2">
          {alertas.length > 0 ? (
            alertas.map((alerta) => {
              const Icon = ALERTA_ICONS[alerta.id] || AlertTriangle;
              return (
                <div
                  key={alerta.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-2xl text-xs border cursor-pointer group transition-all hover:scale-[1.02]",
                    alerta.tipo === "danger" ? "bg-destructive/5 border-destructive/20 text-destructive" :
                    alerta.tipo === "warning" ? "bg-warning/5 border-warning/20 text-warning" :
                    "bg-primary/5 border-primary/20 text-primary"
                  )}
                  onClick={() => navigate(alerta.rota || "/")}
                >
                  <div className="p-2 rounded-xl bg-background/50 shadow-sm">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black uppercase tracking-tight">{alerta.titulo}</p>
                    <p className="text-[10px] font-bold opacity-70 truncate">{alerta.descricao}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedAlertas(prev => new Set([...prev, alerta.id]));
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 opacity-30">
              <ShieldCheck className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Tudo em ordem</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertasConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={alertasConfig}
        onSave={handleSaveConfig}
        initialStartDate={alertStartDate}
        onStartDateChange={setAlertStartDate}
      />
    </div>
  );
}

import { differenceInMonths, ShieldCheck } from "date-fns";
import { toast } from "sonner";