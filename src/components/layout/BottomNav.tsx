import { useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  BarChart3,
  TrendingUp,
  Car,
  Wallet,
  Building,
  ArrowLeft,
  Download,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "@/hooks/use-toast";

const NAV_SECTIONS = {
  financeiro: {
    label: "Financeiro",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Receitas & Despesas", to: "/receitas-despesas", icon: Receipt },
      { label: "Empréstimos", to: "/emprestimos", icon: CreditCard },
      { label: "Relatórios", to: "/relatorios", icon: BarChart3 },
    ],
  },
  investimentos: {
    label: "Investimentos",
    items: [{ label: "Carteira Geral", to: "/investimentos", icon: TrendingUp }],
  },
  patrimonio: {
    label: "Patrimônio",
    items: [
      { label: "Veículos", to: "/veiculos", icon: Car },
      { label: "Carteira Geral", to: "/investimentos", icon: TrendingUp },
    ],
  },
} as const;

const ROOT_ITEMS = [
  { id: "financeiro" as const, label: "Financeiro", icon: Wallet },
  { id: "investimentos" as const, label: "Investimentos", icon: TrendingUp },
  { id: "patrimonio" as const, label: "Patrimônio", icon: Building },
];

type SectionId = keyof typeof NAV_SECTIONS;

type Level = "root" | SectionId;

export function BottomNav() {
  const location = useLocation();
  const { exportData, importData } = useFinance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [level, setLevel] = useState<Level>("root");

  const isPathActive = (path: string) => location.pathname === path;

  const handleExport = () => {
    exportData();
    toast({
      title: "Exportação concluída",
      description: "Arquivo finance-data.json baixado com sucesso!",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo JSON válido.",
        variant: "destructive",
      });
      return;
    }

    const result = await importData(file);

    toast({
      title: result.success ? "Sucesso" : "Erro",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const renderRoot = () => (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      {ROOT_ITEMS.map((item) => {
        const Icon = item.icon;
        const hasActiveChild = NAV_SECTIONS[item.id].items.some((sub) =>
          isPathActive(sub.to),
        );

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setLevel(item.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
              hasActiveChild
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors",
                hasActiveChild && "bg-primary/10",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="leading-none truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderSection = (sectionId: SectionId) => {
    const section = NAV_SECTIONS[sectionId];

    return (
      <div className="flex flex-col gap-1 px-2 py-1">
        <div className="flex items-center gap-2 px-1 pb-1">
          <button
            type="button"
            onClick={() => setLevel("root")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Principal</span>
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setLevel("root")}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="leading-none truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center md:hidden pointer-events-none">
      <div className="pointer-events-auto glass-card rounded-[1.75rem] border border-border/60 bg-card/95 shadow-lg max-w-[480px] w-[calc(100%-2rem)] flex flex-col">
        {level === "root" ? renderRoot() : renderSection(level)}

        <div className="flex items-center justify-end gap-2 px-2 pb-1 pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={handleImportClick}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
