import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Shield, AlertTriangle, DollarSign, Search, CheckCircle2, Clock, Eye, Trash2, ArrowRight } from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { cn, parseDateLocal } from "@/lib/utils";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCard } from "@/components/ui/KpiCard";
import { FipeConsultaDialog } from "@/components/vehicles/FipeConsultaDialog";

const Veiculos = () => {
  const { 
    veiculos, 
    deleteVeiculo, 
    getPendingVehicles,
    segurosVeiculo,
    getValorFipeTotal,
    transacoesV2,
    dateRanges,
    setDateRanges
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState("veiculos");
  const [showFipeDialog, setShowFipeDialog] = useState(false);
  
  const pendingVehicles = getPendingVehicles();
  const totalFipe = getValorFipeTotal(dateRanges.range1.to);

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="space-y-3 animate-fade-in border-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="inline-flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Imobilizado e Veículos</span>
                <span className="text-[11px]">Gestão Patrimonial</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 max-w-full">
            <PeriodSelector 
              initialRanges={dateRanges}
              onDateRangeChange={setDateRanges}
              className="h-8 rounded-full border-none bg-card px-3 text-[11px] font-medium text-secondary shadow-xs"
            />
            <Button 
              variant="tonal" 
              size="sm" 
              onClick={() => setShowFipeDialog(true)}
              className="h-8 rounded-full gap-1.5 px-3 text-[11px] font-medium bg-card text-secondary border-none shadow-xs hover:bg-card/90"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Consulta FIPE</span>
            </Button>
          </div>
        </header>

        {pendingVehicles.length > 0 && (
          <div className="space-y-3">
             <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-warning">Cadastros Pendentes</p>
             </div>
             <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar-mobile">
                {pendingVehicles.map(v => (
                  <div key={v.id} className="min-w-[280px] p-4 rounded-2xl border-2 border-dashed border-warning/30 bg-warning/5 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-warning-foreground leading-tight">Configurar Compra</p>
                        <p className="text-[10px] opacity-70">Em {parseDateLocal(v.dataCompra).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-full bg-warning/20 text-warning group-hover:scale-110 transition-transform">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Avaliação FIPE" value={formatCurrency(totalFipe)} status="success" icon={<DollarSign className="w-6 h-6" />} />
          <KpiCard title="Veículos" value={veiculos.filter(v => v.status === 'ativo').length.toString()} status="neutral" icon={<Car className="w-6 h-6" />} delay={50} />
          <KpiCard title="Seguros Ativos" value={segurosVeiculo.length.toString()} status="info" icon={<Shield className="w-6 h-6" />} delay={100} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="border-b border-border/40 px-1">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
              <TabsTrigger value="veiculos" className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-3 text-xs font-bold uppercase">Meus Carros</TabsTrigger>
              <TabsTrigger value="parcelas" className="bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-3 text-xs font-bold uppercase">Parcelas Seguro</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="veiculos" className="animate-fade-in-up">
            <div className="glass-card p-5 rounded-[1.75rem] border-border/40 overflow-hidden">
               <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Veículo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Ano</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right">Avaliação FIPE</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veiculos.filter(v => v.status === 'ativo').map(v => (
                    <TableRow key={v.id} className="border-none hover:bg-muted/30 transition-colors odd:bg-muted/10">
                      <TableCell className="py-4">
                        <p className="font-bold text-sm text-foreground">{v.modelo}</p>
                        <p className="text-[10px] text-muted-foreground">{v.marca}</p>
                      </TableCell>
                      <TableCell className="font-bold text-sm">{v.ano}</TableCell>
                      <TableCell className="text-right font-black text-sm text-success">{formatCurrency(v.valorFipe)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => deleteVeiculo(v.id)} className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
               </Table>
            </div>
          </TabsContent>

          <TabsContent value="parcelas" className="animate-fade-in-up">
            <div className="glass-card p-5 rounded-[1.75rem] border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-none">
                    <TableHead className="text-[10px] font-black uppercase">Seguro/Veículo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Vencimento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Valor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segurosVeiculo.flatMap(s => s.parcelas.map(p => ({ ...p, seguro: s }))).map((p, idx) => {
                    const statusClass = p.paga ? "bg-success/10 text-success" : "bg-warning/10 text-warning";
                    return (
                      <TableRow key={idx} className="border-none hover:bg-muted/30">
                        <TableCell>
                          <p className="text-xs font-bold">{p.seguro.seguradora}</p>
                          <p className="text-[9px] opacity-60">Parcela {p.numero}/{p.seguro.numeroParcelas}</p>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{new Date(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-black text-xs">{formatCurrency(p.valor)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn("text-[9px] border-none font-black", statusClass)}>
                            {p.paga ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {p.paga ? "Paga" : "Pendente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <FipeConsultaDialog open={showFipeDialog} onOpenChange={setShowFipeDialog} />
    </MainLayout>
  );
};

export default Veiculos;