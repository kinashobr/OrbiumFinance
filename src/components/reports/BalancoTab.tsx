"use client";

import { useMemo } from "react";
import { 
  TrendingUp, TrendingDown, Scale, Building2, Car, 
  Banknote, Shield, History, CreditCard, ArrowUpRight, 
  Info, LineChart, PieChart, LayoutGrid, Sparkles
} from "lucide-react";
import { useFinance } from "@/contexts/FinanceContext";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS, ComparisonDateRanges, formatCurrency } from "@/types/finance";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";
import { subMonths, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function BalancoTab({ dateRanges }: { dateRanges: ComparisonDateRanges }) {
  const { 
    transacoesV2, contasMovimento, calculateBalanceUpToDate, 
    getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, 
    calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining,
    getCreditCardDebt, getPatrimonioLiquido
  } = useFinance();

  const finalDate = dateRanges.range1.to || new Date();
  const prevDate = dateRanges.range2.to || subMonths(finalDate, 1);

  const b1 = useMemo(() => {
    const saldos = contasMovimento.reduce((acc, c) => ({ 
      ...acc, 
      [c.id]: calculateBalanceUpToDate(c.id, finalDate, transacoesV2, contasMovimento) 
    }), {} as Record<string, number>);
    
    // Ativos
    const circulantesRaw = contasMovimento.filter(c => ['corrente', 'poupanca', 'reserva'].includes(c.accountType));
    const invNaoCirculantesRaw = contasMovimento.filter(c => ['renda_fixa', 'cripto', 'objetivo'].includes(c.accountType));
    
    const ativoCirculante = circulantesRaw.reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0);
    const investimentosNaoCirculantes = invNaoCirculantesRaw.reduce((acc, c) => acc + Math.max(0, saldos[c.id] || 0), 0);
    const imobilizadoFipe = getValorFipeTotal(finalDate);
    const segurosAApropriar = getSegurosAApropriar(finalDate);
    const totalAtivos = ativoCirculante + investimentosNaoCirculantes + imobilizadoFipe + segurosAApropriar;

    // Passivos
    const dividaCartoes = getCreditCardDebt(finalDate);
    const principalLoans12m = calculateLoanPrincipalDueInNextMonths(finalDate, 12);
    const segurosAPagar = getSegurosAPagar(finalDate);
    const passivoCirculante = dividaCartoes + principalLoans12m + segurosAPagar;
    
    const totalLoans = getLoanPrincipalRemaining(finalDate);
    const passivoNaoCirculante = Math.max(0, totalLoans - principalLoans12m);
    const totalPassivos = passivoCirculante + passivoNaoCirculante;

    const pl = totalAtivos - totalPassivos;

    return {
      totalAtivos, ativoCirculante, investimentosNaoCirculantes, imobilizadoFipe, segurosAApropriar,
      totalPassivos, passivoCirculante, passivoNaoCirculante, pl,
      contasCirculantes: circulantesRaw.map(c => ({ ...c, saldo: saldos[c.id] || 0 })),
      contasInvestimentos: invNaoCirculantesRaw.map(c => ({ ...c, saldo: saldos[c.id] || 0 }))
    };
  }, [contasMovimento, transacoesV2, calculateBalanceUpToDate, getValorFipeTotal, getSegurosAApropriar, getSegurosAPagar, calculateLoanPrincipalDueInNextMonths, getLoanPrincipalRemaining, getCreditCardDebt, finalDate]);

  // Variação de PL
  const plAnterior = getPatrimonioLiquido(prevDate);
  const variacaoPlPerc = plAnterior !== 0 ? ((b1.pl - plAnterior) / Math.abs(plAnterior)) * 100 : 0;

  // Gráfico de Evolução (Mock/Calculado)
  const evolutionData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = endOfMonth(subMonths(finalDate, 6 - i));
      return { mes: format(d, 'MMM', { locale: ptBR }), valor: getPatrimonioLiquido(d) };
    });
  }, [getPatrimonioLiquido, finalDate]);

  const ItemCard = ({ title, value, subtitle, icon: Icon, colorClass, percent }: any) => (
    <div className="bg-card rounded-[1.75rem] p-5 border border-border/40 hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", colorClass.bg, colorClass.text)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">{subtitle}</p>
          <p className="text-base font-black tabular-nums">{formatCurrency(value)}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
           <span className="truncate max-w-[120px]">{title}</span>
           <span>{percent.toFixed(0)}%</span>
        </div>
        <Progress value={percent} className="h-1 rounded-full" />
      </div>
    </div>
  );

  const SmallKpi = ({ label, value, color }: any) => (
    <div className="p-5 rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-white/60 dark:border-white/5 shadow-sm">
       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
       <p className={cn("text-lg font-black tabular-nums", color)}>{formatCurrency(value)}</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* HERO CARD - PATRIMÔNIO LÍQUIDO */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-[40px] p-10 shadow-soft relative overflow-hidden border border-white/60 dark:border-white/5 h-[320px] flex flex-col justify-center group">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent"></div>
         <div className="absolute right-0 top-0 opacity-10 scale-150 translate-x-10 -translate-y-10 group-hover:rotate-6 transition-transform duration-1000">
            <LineChart className="w-[300px] h-[300px] text-primary" />
         </div>

         <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-widest">Consolidado Patrimonial</Badge>
              <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orbium Insights</span></div>
            </div>
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Patrimônio Líquido Final</h2>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
               <h3 className="font-display font-extrabold text-6xl sm:text-7xl text-foreground tracking-tighter leading-none tabular-nums">{formatCurrency(b1.pl)}</h3>
               <Badge className={cn("rounded-xl px-4 py-2 font-black text-sm gap-2 mb-2", variacaoPlPerc >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {variacaoPlPerc >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(variacaoPlPerc).toFixed(1)}% evolução
               </Badge>
            </div>
         </div>
      </div>

      {/* GRID DE INDICADORES TÉCNICOS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
         <SmallKpi label="Total Ativos" value={b1.totalAtivos} color="text-success" />
         <SmallKpi label="Ativos Circulantes" value={b1.ativoCirculante} color="text-success/80" />
         <SmallKpi label="Inv. Não Circulantes" value={b1.investimentosNaoCirculantes} color="text-indigo-500" />
         <SmallKpi label="Total Passivos" value={b1.totalPassivos} color="text-destructive" />
         <SmallKpi label="Patrimônio Líquido" value={b1.pl} color="text-primary" />
         <SmallKpi label="Variação PL" value={b1.pl - plAnterior} color={b1.pl >= plAnterior ? "text-success" : "text-destructive"} />
      </div>

      {/* LEDGER COMPARATIVO (ATIVO VS PASSIVO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* COLUNA ATIVOS (VERDE) */}
        <div className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-success/10 rounded-2xl text-success"><TrendingUp className="w-6 h-6" /></div>
                 <div><h3 className="font-display font-black text-2xl uppercase tracking-tight">Ativo Total</h3><p className="text-[10px] font-bold text-success/60 uppercase tracking-widest">Disponibilidade e Bens</p></div>
              </div>
              <p className="text-3xl font-black text-success tracking-tighter tabular-nums">{formatCurrency(b1.totalAtivos)}</p>
           </div>

           <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-success/10 space-y-10">
              {/* Ativo Circulante */}
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Ativo Circulante (Disponível)</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {b1.contasCirculantes.map(c => (
                      <ItemCard key={c.id} title={c.name} value={c.saldo} subtitle={ACCOUNT_TYPE_LABELS[c.accountType]} icon={Building2} colorClass={{ bg: 'bg-green-100/50 dark:bg-green-900/20', text: 'text-success' }} percent={b1.totalAtivos > 0 ? (c.saldo / b1.totalAtivos) * 100 : 0} />
                    ))}
                 </div>
              </div>

              {/* Ativo Não Circulante */}
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Ativo Não Circulante (Realizável)</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {b1.contasInvestimentos.map(c => (
                      <ItemCard key={c.id} title={c.name} value={c.saldo} subtitle={ACCOUNT_TYPE_LABELS[c.accountType]} icon={Shield} colorClass={{ bg: 'bg-indigo-100/50 dark:bg-indigo-900/20', text: 'text-indigo-600' }} percent={b1.totalAtivos > 0 ? (c.saldo / b1.totalAtivos) * 100 : 0} />
                    ))}
                    {b1.imobilizadoFipe > 0 && <ItemCard title="Imobilizado" value={b1.imobilizadoFipe} subtitle="Avaliação FIPE" icon={Car} colorClass={{ bg: 'bg-primary/10', text: 'text-primary' }} percent={(b1.imobilizadoFipe / b1.totalAtivos) * 100} />}
                 </div>
              </div>
           </div>
        </div>

        {/* COLUNA PASSIVOS (VERMELHO) */}
        <div className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-destructive/10 rounded-2xl text-destructive"><TrendingDown className="w-6 h-6" /></div>
                 <div><h3 className="font-display font-black text-2xl uppercase tracking-tight">Passivo Total</h3><p className="text-[10px] font-bold text-destructive/60 uppercase tracking-widest">Obrigações e Dívidas</p></div>
              </div>
              <p className="text-3xl font-black text-destructive tracking-tighter tabular-nums">{formatCurrency(b1.totalPassivos)}</p>
           </div>

           <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-destructive/10 space-y-10">
              {/* Passivo Circulante */}
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Passivo Circulante (Curto Prazo)</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {b1.dividaCartoes > 0 && <ItemCard title="Cartões" value={b1.dividaCartoes} subtitle="Faturas em aberto" icon={CreditCard} colorClass={{ bg: 'bg-red-100/50 dark:bg-red-900/20', text: 'text-destructive' }} percent={(b1.dividaCartoes / b1.totalPassivos) * 100} />}
                    {b1.passivoCirculante > b1.dividaCartoes && <ItemCard title="Financiamentos 12m" value={b1.passivoCirculante - b1.dividaCartoes} subtitle="Parcelas curto prazo" icon={Banknote} colorClass={{ bg: 'bg-orange-100/50 dark:bg-orange-900/20', text: 'text-orange-600' }} percent={((b1.passivoCirculante - b1.dividaCartoes) / b1.totalPassivos) * 100} />}
                 </div>
              </div>

              {/* Passivo Não Circulante */}
              <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Passivo Não Circulante (Longo Prazo)</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {b1.passivoNaoCirculante > 0 && <ItemCard title="Dívidas Longas" value={b1.passivoNaoCirculante} subtitle="Excedente a 1 ano" icon={History} colorClass={{ bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-muted-foreground' }} percent={(b1.passivoNaoCirculante / b1.totalPassivos) * 100} />}
                 </div>
              </div>

              {/* Destaque PL no rodapé do Passivo */}
              <div className="pt-6 border-t border-border/40">
                 <div className="bg-gradient-to-r from-primary to-primary-dark rounded-[2rem] p-7 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 opacity-10 scale-125 translate-x-4 translate-y-4 group-hover:rotate-12 transition-transform duration-700"><Scale className="w-32 h-32" /></div>
                    <div className="relative z-10"><p className="text-[10px] font-black uppercase tracking-[0.3em] mb-1 opacity-80">Riqueza Líquida</p><p className="text-3xl font-black tabular-nums">{formatCurrency(b1.pl)}</p></div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* SEÇÃO DE GRÁFICOS REINTRODUZIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 shadow-soft">
            <div className="flex items-center gap-3 mb-8 px-2">
               <div className="p-2 bg-primary/10 rounded-xl text-primary"><LineChart className="w-5 h-5" /></div>
               <h4 className="font-display font-black text-xl text-foreground uppercase tracking-tight">Evolução Patrimonial</h4>
            </div>
            <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData}>
                     <defs><linearGradient id="plGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                     <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 'bold'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} tickFormatter={v => `R$ ${v/1000}k`} />
                     <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} formatter={(v: number) => [formatCurrency(v), 'PL']} />
                     <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#plGradient)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-surface-light dark:bg-surface-dark rounded-[3rem] p-8 border border-white/60 dark:border-white/5 shadow-soft flex flex-col">
            <div className="flex items-center gap-3 mb-8 px-2">
               <div className="p-2 bg-accent/10 rounded-xl text-accent"><PieChart className="w-5 h-5" /></div>
               <h4 className="font-display font-black text-xl text-foreground uppercase tracking-tight">Composição</h4>
            </div>
            <div className="flex-1 min-h-[240px]">
               <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                     <Pie data={[
                        { name: 'Circulante', value: b1.ativoCirculante },
                        { name: 'Imobilizado', value: b1.imobilizadoFipe },
                        { name: 'Investimentos', value: b1.investimentosNaoCirculantes }
                     ]} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                        <Cell fill="hsl(var(--success))" />
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--accent))" />
                     </Pie>
                     <Tooltip />
                  </RePieChart>
               </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
               {['Circ.', 'Imob.', 'Inv.'].map((l, i) => (
                  <div key={l} className="text-center">
                     <p className="text-[9px] font-black text-muted-foreground uppercase">{l}</p>
                     <div className={cn("h-1 rounded-full mt-1", i === 0 ? "bg-success" : i === 1 ? "bg-primary" : "bg-accent")} />
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}