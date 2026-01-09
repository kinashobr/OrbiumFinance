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
  Palette,
  Check,
  CircleDollarSign,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarAlertas } from "@/components/dashboard/SidebarAlertas";

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
  const [openSections, setOpenSections] = useState<string[]>(["financeiro", "patrimonio", "investimentos", "relatorios"]);
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
          <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-2xl sidebar-logo-bg flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 sidebar-logo-icon" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sidebar-brand-text truncate">Orbium</span>
                <span className="text-[11px] sidebar-brand-subtitle truncate">Finance pessoal</span>
              </div>
            </div>
            <div className="ml-2 flex items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <span className="text-xs leading-none">{themes.find(t => t.id === theme)?.icon}</span>
                <span className="leading-none truncate max-w-[96px]">
                  {themes.find(t => t.id === theme)?.name ?? "Marrom Claro"}
                </span>
              </span>
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
        <nav className="flex flex-col gap-2">
          {navSections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = openSections.includes(section.id);
            const hasActiveItem = section.items.some((item) => isPathActive(item.path));

            if (collapsed) {
              return (
                <div key={section.id} className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <NavItem
                      key={item.path}
                      item={item}
                      isActive={isPathActive(item.path)}
                    />
                  ))}
                </div>
              );
            }

            return (
              <Collapsible
                key={section.id}
                open={isOpen}
                onOpenChange={() => toggleSection(section.id)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                      hasActiveItem
                        ? "sidebar-section-active"
                        : "sidebar-section-header",
                    )}
                  >
                    <SectionIcon className="w-4 h-4" />
                    <span className="font-semibold text-xs uppercase tracking-wider flex-1">
                      {section.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1 pl-1">
                  {section.items.map((item) => (
                    <NavItem
                      key={item.path}
                      item={item}
                      isActive={isPathActive(item.path)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* Alertas contextuais */}
        <div className="mt-4">
          <SidebarAlertas collapsed={collapsed} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t sidebar-border px-3 py-3 space-y-3">
        {/* Export / Import */}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            {!collapsed && <span className="text-xs font-medium">Exportar dados</span>}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleImportClick}
          >
            <Upload className="w-4 h-4" />
            {!collapsed && <span className="text-xs font-medium">Importar JSON</span>}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Tema removido a pedido: mantemos apenas ações de dados e collapse */}

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
