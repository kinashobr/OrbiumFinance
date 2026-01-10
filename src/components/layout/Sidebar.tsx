import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, CreditCard, Car, ChevronLeft, ChevronRight, Wallet, Download, Upload, TrendingUp, PieChart, BarChart3, Building, Bell, Settings, Settings2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/contexts/FinanceContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarAlertas } from "@/components/dashboard/SidebarAlertas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  isActive: boolean;
  label: string;
}

const navItems: NavItemProps[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", isActive: false },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios", isActive: false },
  { to: "/receitas-despesas", icon: Receipt, label: "Finanças", isActive: false },
  { to: "/emprestimos", icon: CreditCard, label: "Dívidas", isActive: false },
  { to: "/investimentos", icon: TrendingUp, label: "Investimentos", isActive: false },
  { to: "/veiculos", icon: Car, label: "Veículos", isActive: false },
];

export function Sidebar() {
  const location = useLocation();
  const { exportData, importData } = useFinance();
  const { theme, setTheme, themes } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportData();
    toast.success("Arquivo finance-data.json baixado com sucesso!");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Por favor, selecione um arquivo JSON válido.");
      return;
    }
    const result = await importData(file);
    toast[result.success ? "success" : "error"]({
      title: result.success ? "Sucesso" : "Erro",
      description: result.message,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const NavItem = ({ to, icon: Icon, label }: NavItemProps) => {
    const isActive = location.pathname === to;
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={to}
            className={cn(
              "w-full aspect-square rounded-2xl flex items-center justify-center relative group transition-all duration-200",
              isActive 
                ? "bg-primary/10 text-primary shadow-glow" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}
            <Icon className={cn("w-6 h-6 transition-transform duration-200", isActive && "scale-110")} />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="sidebar-tooltip">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-24 bg-card h-screen flex-col items-center py-8 border-r border-border/40 shrink-0">
      {/* Header - Logo */}
      <div className="mb-12 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg shadow-primary/30 ring-4 ring-primary/10 cursor-pointer">
              <Wallet className="w-6 h-6" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="sidebar-tooltip">
            Orbium Finance
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation - Fixed Icons */}
      <nav className="flex-1 flex flex-col gap-4 w-full px-4">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} isActive={location.pathname === item.to} />
        ))}
      </nav>

      {/* Footer actions (Settings/Alerts) */}
      <div className="mt-auto flex flex-col gap-4 w-full px-4 shrink-0">
        {/* Alerts */}
        <Dialog>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="w-full aspect-square rounded-2xl text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center justify-center relative">
                  <Bell className="w-6 h-6" />
                  {/* Placeholder for badge */}
                  <span className="w-2 h-2 bg-destructive rounded-full absolute top-3 right-3 border border-card" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="sidebar-tooltip">Alertas</TooltipContent>
            </Tooltip>
          </DialogTrigger>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-sm">Alertas Financeiros</DialogTitle>
            </DialogHeader>
            <div className="px-3 pb-4">
              <SidebarAlertas collapsed={false} />
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings/Data */}
        <Dialog>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="w-full aspect-square rounded-2xl text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center justify-center">
                  <Settings className="w-6 h-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="sidebar-tooltip">Configurações</TooltipContent>
            </Tooltip>
          </DialogTrigger>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-sm">Aparência & Dados</DialogTitle>
            </DialogHeader>
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tema</p>
                <div className="flex flex-wrap gap-1">
                  {themes.map(t => {
                    const isActive = theme === t.id;
                    return (
                      <button 
                        key={t.id} 
                        type="button" 
                        onClick={() => setTheme(t.id)} 
                        className={cn(
                          "inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors overflow-hidden gap-1", 
                          isActive ? "bg-primary/10 border-primary text-primary" : "bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span className="text-xs leading-none flex-shrink-0">{t.icon}</span>
                        <span className="leading-none truncate max-w-[96px]">
                          {t.id === "system" ? "Sistema" : t.id === "brown-light" ? "Claro" : "Escuro"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator className="border-border/50" />
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Dados</p>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={handleExport}>
                    <Download className="w-4 h-4" />
                    Exportar dados
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={handleImportClick}>
                    <Upload className="w-4 h-4" />
                    Importar JSON
                  </Button>
                  <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}