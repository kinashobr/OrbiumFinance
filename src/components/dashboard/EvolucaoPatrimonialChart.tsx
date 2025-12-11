import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
// Removed unused import: useFinance

interface EvolucaoData {
  mes: string;
  patrimonioTotal: number;
  receitas: number;
  despesas: number;
  investimentos: number;
  dividas: number;
}

interface EvolucaoPatrimonialChartProps {
  data: EvolucaoData[];
}

const lineOptions = [
  { id: "patrimonioTotal", label: "Patrimônio", color: "hsl(199, 89%, 48%)" },
  { id: "receitas", label: "Receitas", color: "hsl(142, 76%, 36%)" },
  { id: "despesas", label: "Despesas", color: "hsl(0, 72%, 51%)" },
  { id: "investimentos", label: "Investimentos", color: "hsl(270, 100%, 65%)" },
  { id: "dividas", label: "Dívidas", color: "hsl(38, 92%, 50%)" },
];

export function EvolucaoPatrimonialChart({ data }: EvolucaoPatrimonialChartProps) {
  // Removed unused context imports
  const [periodo, setPeriodo] = useState("12m");
  const [activeLines, setActiveLines] = useState<Set<string>>(
    new Set(["patrimonioTotal", "receitas", "despesas"])
  );

  const toggleLine = (lineId: string) => {
    setActiveLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) newSet.delete(lineId);
      else newSet.add(lineId);
      return newSet;
    });
  };

  // Use the data prop directly, which is already filtered by the parent component (Index.tsx)
  const dataToShow = useMemo(() => {
    // The data array is expected to contain 12 months of data (or less if filtered by the parent).
    // We slice based on the end of the array to show the most recent months available in the data prop.
    switch (periodo) {
      case "3m": return data.slice(-3);
      case "6m": return data.slice(-6);
      case "12m": return data;
      default: return data;
    }
  }, [data, periodo]);

  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Evolução Patrimonial</h3>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-28 bg-muted border-border h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="12m">12 meses</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-1">
            {lineOptions.map(line => (
              <Button
                key={line.id}
                variant="outline"
                size="icon"
                onClick={() => toggleLine(line.id)}
                className={cn(
                  "h-8 w-8 text-xs",
                  activeLines.has(line.id) ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/50 text-muted-foreground border-border"
                )}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: line.color }} />
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dataToShow}>
            <defs>
              {lineOptions.map(line => (
                <linearGradient key={line.id} id={`gradient-${line.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                  </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 18%)" vertical={false} />
            <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 20%, 8%)",
                border: "1px solid hsl(220, 20%, 18%)",
                borderRadius: "12px",
              }}
              formatter={(value: number, name: string) => [`R$ ${value.toLocaleString("pt-BR")}`, lineOptions.find(l => l.id === name)?.label || name]}
            />
            <Legend />
            {lineOptions.map(line => (
              activeLines.has(line.id) && (
                <Area key={line.id} type="monotone" dataKey={line.id} stroke={line.color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${line.id})`} />
              )
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}