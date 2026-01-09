import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Car,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Download,
  Upload,
  TrendingUp,
  PieChart,
  BarChart3,
  Building,
  Bell,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/contexts/FinanceContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarAlertas } from "@/components/dashboard/SidebarAlertas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NavSection {
  id: string;
  title: string;
  icon: React.ElementType;
  items: {
    title: string;
    path: string;
    icon: React.ElementType;
  }[];
}

const navSections: NavSection[] = [
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    items: [
      { title: "Dashboard", path: "/", icon: LayoutDashboard },
      { title: "Receitas & Despesas", path: "/receitas-despesas", icon: Receipt },
      { title: "Empréstimos", path: "/emprestimos", icon: CreditCard },
      { title: "Relatórios", path: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    id: "investimentos",
    title: "Investimentos",
    icon: TrendingUp,
    items: [{ title: "Carteira Geral", path: "/investimentos", icon: PieChart }],
  },
  {
    id: "patrimonio",
    title: "Patrimônio",
    icon: Building,
    items: [{ title: "Veículos", path: "/veiculos", icon: Car }],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["financeiro", "patrimonio", "investimentos"]);
  const [showAlerts, setShowAlerts] = useState(false);
  const location = useLocation();
  const { exportData, importData } = useFinance();
  const { theme, setTheme, themes } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed) {
      setCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // Save collapsed state and dispatch event for MainLayout
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed));
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: collapsed }));
  }, [collapsed]);

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

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const isPathActive = (path: string) => {
    return location.pathname === path;
  };

  const NavItem = ({
    item,
    isActive,
  }: {
    item: { title: string; path: string; icon: React.ElementType };
    isActive: boolean;
  }) => {
    const Icon = item.icon;

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to={item.path}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 mx-auto",
                isActive ? "sidebar-nav-active" : "sidebar-nav-item",
              )}
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="sidebar-tooltip">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
          isActive ? "sidebar-nav-active" : "sidebar-nav-item",
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium text-sm truncate">{item.title}</span>
        {isActive && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse" />
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-4 top-4 bottom-4 z-40 glass-card rounded-[2rem] border border-border/40 bg-card shadow-lg transition-all duration-300 ease-in-out flex-col",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Header - Logo & App Name (Desktop) */}
      <div className="h-16 flex items-center px-4 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl sidebar-logo-bg flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 sidebar-logo-icon" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm sidebar-brand-text truncate">Orbium</span>
              <span className="text-[11px] sidebar-brand-subtitle truncate">Finance pessoal</span>
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-10 h-10 rounded-2xl sidebar-logo-bg flex items-center justify-center mx-auto cursor-pointer">
                <Wallet className="w-5 h-5 sidebar-logo-icon" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="sidebar-tooltip">
              Orbium Finance
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Navigation - Scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2">
        <nav className="flex flex-col gap-0.5">
          {[...navSections[0].items, ...navSections[1].items, ...navSections[2].items].map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isActive={isPathActive(item.path)}
            />
          ))}
        </nav>
      </div>

      {/* Footer actions + Theme selector + Alerts */}
      <div className="border-t sidebar-border px-3 py-3 space-y-3 mt-auto">
        {/* Alerts bell + settings */}
        <div className="flex items-center justify-end gap-2 mb-1">
          <div className="flex items-center gap-1">

            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full sidebar-action-btn flex items-center justify-center"
                  aria-label="Ver alertas"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4" />
                    Alertas financeiros
                  </DialogTitle>
                </DialogHeader>
                <div className="px-3 pb-4">
                  <SidebarAlertas collapsed={false} />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full sidebar-action-btn flex items-center justify-center"
                  aria-label="Aparência e dados"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                  <DialogTitle className="text-sm">Aparência</DialogTitle>
                </DialogHeader>
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tema</p>
                    <div className="flex flex-wrap gap-1">
                      {themes.map((t) => {
                        const isActive = theme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTheme(t.id)}
                            className={cn(
                              "inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors overflow-hidden gap-1",
                              isActive
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted",
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

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Dados</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 text-xs"
                        onClick={handleExport}
                      >
                        <Download className="w-4 h-4" />
                        Exportar dados
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-xs"
                        onClick={handleImportClick}
                      >
                        <Upload className="w-4 h-4" />
                        Importar JSON
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Collapse Toggle */}
        <div className="pt-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="w-9 h-9 rounded-full sidebar-collapse-btn flex items-center justify-center mx-auto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="sidebar-tooltip">
                Expandir sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="w-full py-2 rounded-full sidebar-collapse-btn flex items-center justify-center gap-2 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              Recolher
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

