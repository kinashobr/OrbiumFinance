import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  BarChart3,
  TrendingUp,
  Car,
  Download,
  Upload,
  MoreVertical,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { SidebarAlertas } from "@/components/dashboard/SidebarAlertas";

const FINANCE_ITEMS = [
  { label: "Receitas & Despesas", to: "/receitas-despesas", icon: Receipt },
  { label: "Empréstimos", to: "/emprestimos", icon: CreditCard },
  { label: "Relatórios", to: "/relatorios", icon: BarChart3 },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { exportData, importData } = useFinance();
  const { theme, setTheme, themes } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [showFinanceGroup, setShowFinanceGroup] = useState(false);

  const isPathActive = (path: string) => location.pathname === path;
  const isFinanceActive = FINANCE_ITEMS.some((item) => isPathActive(item.to));

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

  return (
    <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center md:hidden pointer-events-none">
      <div className="pointer-events-auto glass-card rounded-[1.75rem] border border-border/60 bg-card/95 shadow-lg max-w-[480px] w-[calc(100%-2rem)] flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center justify-between gap-1 px-2 py-1">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {/* Dashboard */}
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "group flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors min-w-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors transition-transform group-hover:-translate-y-0.5",
                  isPathActive("/") && "bg-primary/10",
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <span className="leading-none text-center truncate max-w-[80px]">
                Dashboard
              </span>
            </NavLink>

            {/* Grupo Financeiro */}
            <button
              type="button"
              onClick={() => setShowFinanceGroup((prev) => !prev)}
              className={cn(
                "group flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors min-w-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                showFinanceGroup || isFinanceActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors transition-transform group-hover:-translate-y-0.5",
                  (showFinanceGroup || isFinanceActive) && "bg-primary/10",
                )}
              >
                <Receipt className="h-4 w-4" />
              </div>
              <span className="leading-none text-center truncate max-w-[80px]">
                Financeiro
              </span>
            </button>

            {/* Investimentos */}
            <NavLink
              to="/investimentos"
              className={({ isActive }) =>
                cn(
                  "group flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors min-w-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors transition-transform group-hover:-translate-y-0.5",
                  isPathActive("/investimentos") && "bg-primary/10",
                )}
              >
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="leading-none text-center truncate max-w-[80px]">
                Investimentos
              </span>
            </NavLink>

            {/* Veículos */}
            <NavLink
              to="/veiculos"
              className={({ isActive }) =>
                cn(
                  "group flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors min-w-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors transition-transform group-hover:-translate-y-0.5",
                  isPathActive("/veiculos") && "bg-primary/10",
                )}
              >
                <Car className="h-4 w-4" />
              </div>
              <span className="leading-none text-center truncate max-w-[80px]">
                Veículos
              </span>
            </NavLink>
          </div>

          <div className="flex items-center justify-end px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="text-xs min-w-[220px]">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Navegação extra
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/investimentos")}>
                  <TrendingUp className="mr-2 h-3.5 w-3.5" /> Carteira Geral
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/veiculos")}>
                  <Car className="mr-2 h-3.5 w-3.5" /> Veículos
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Tema
                </DropdownMenuLabel>
                {themes.map((t) => {
                  const isActive = theme === t.id;
                  return (
                    <DropdownMenuItem
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 py-1.5 text-[11px]",
                        isActive && "text-primary",
                      )}
                      onClick={() => setTheme(t.id)}
                    >
                      <span className="text-xs leading-none">{t.icon}</span>
                      <span className="truncate">
                        {t.id === "system"
                          ? "Sistema"
                          : t.id === "brown-light"
                          ? "Claro"
                          : "Escuro"}
                      </span>
                    </DropdownMenuItem>
                  );
                })}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Dados & alertas
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Exportar dados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportClick}>
                  <Upload className="mr-2 h-3.5 w-3.5" /> Importar JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAlerts(true)}>
                  <Bell className="mr-2 h-3.5 w-3.5" /> Alertas
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowNavDrawer(true)}>
                  Navegação avançada
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {showFinanceGroup && (
          <div className="flex items-center gap-1 px-3 pb-2 pt-1 border-t border-border/60 bg-background/60 rounded-b-[1.75rem]">
            {FINANCE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(item.to);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-medium transition-colors",
                    active
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="leading-tight text-center truncate max-w-[80px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de alertas financeiros */}
      <Dialog open={showAlerts} onOpenChange={setShowAlerts}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4" /> Alertas financeiros
            </DialogTitle>
          </DialogHeader>
          <div className="px-3 pb-4">
            <SidebarAlertas collapsed={false} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer de navegação avançada seguindo agrupamento da Sidebar */}
      <Drawer open={showNavDrawer} onOpenChange={setShowNavDrawer}>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm font-semibold">Navegação avançada</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Financeiro
              </p>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="text-left rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                  onClick={() => {
                    navigate("/");
                    setShowNavDrawer(false);
                  }}
                >
                  Dashboard
                </button>
                {FINANCE_ITEMS.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    className="text-left rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                    onClick={() => {
                      navigate(item.to);
                      setShowNavDrawer(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Investimentos
              </p>
              <button
                type="button"
                className="w-full text-left rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                onClick={() => {
                  navigate("/investimentos");
                  setShowNavDrawer(false);
                }}
              >
                Carteira Geral
              </button>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Patrimônio
              </p>
              <button
                type="button"
                className="w-full text-left rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                onClick={() => {
                  navigate("/veiculos");
                  setShowNavDrawer(false);
                }}
              >
                Veículos
              </button>
            </div>

            <DrawerClose asChild>
              <button
                type="button"
                className="mt-1 w-full rounded-full border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Fechar
              </button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  );
}
