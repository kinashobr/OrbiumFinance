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
  ArrowLeft,
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
  { label: "Extratos", to: "/receitas-despesas", icon: Receipt },
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
    <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center md:hidden pointer-events-none px-4">
      <div className="pointer-events-auto glass-card rounded-full border border-border/60 bg-card/95 shadow-lg max-w-[480px] w-full overflow-hidden transition-all duration-300">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center h-16 px-2">
          {/* Container animado para troca de itens na mesma linha */}
          <div className="flex flex-1 items-center h-full relative overflow-hidden">
            
            {/* Menu Principal */}
            <div className={cn(
              "flex items-center gap-1 w-full transition-all duration-300 transform absolute inset-0 px-2",
              showFinanceGroup ? "-translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
            )}>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <div className={cn("p-2 rounded-xl transition-colors", isPathActive("/") && "bg-primary/10")}>
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <span>Início</span>
              </NavLink>

              <button
                type="button"
                onClick={() => setShowFinanceGroup(true)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
                  isFinanceActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors", isFinanceActive && "bg-primary/10")}>
                  <Receipt className="h-5 w-5" />
                </div>
                <span>Financeiro</span>
              </button>

              <NavLink
                to="/investimentos"
                className={({ isActive }) =>
                  cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <div className={cn("p-2 rounded-xl transition-colors", isPathActive("/investimentos") && "bg-primary/10")}>
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span>Investir</span>
              </NavLink>

              <NavLink
                to="/veiculos"
                className={({ isActive }) =>
                  cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <div className={cn("p-2 rounded-xl transition-colors", isPathActive("/veiculos") && "bg-primary/10")}>
                  <Car className="h-5 w-5" />
                </div>
                <span>Veículos</span>
              </NavLink>
            </div>

            {/* Menu Financeiro (Submenu) */}
            <div className={cn(
              "flex items-center gap-1 w-full transition-all duration-300 transform absolute inset-0 px-2",
              showFinanceGroup ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}>
              <button
                type="button"
                onClick={() => setShowFinanceGroup(false)}
                className="flex-none flex flex-col items-center justify-center gap-1 p-2 text-primary"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <ArrowLeft className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold">Voltar</span>
              </button>

              <div className="flex-1 flex items-center justify-around">
                {FINANCE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(item.to);
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        navigate(item.to);
                        setShowFinanceGroup(false);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl transition-colors", active && "bg-primary/10")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Botão de Opções (Fixo à direita) */}
          <div className="flex-none flex items-center justify-center pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="text-xs min-w-[220px] rounded-2xl mb-2">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Tema
                </DropdownMenuLabel>
                {themes.map((t) => {
                  const isActive = theme === t.id;
                  return (
                    <DropdownMenuItem
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 py-2 text-[11px]",
                        isActive && "text-primary",
                      )}
                      onClick={() => setTheme(t.id)}
                    >
                      <span className="text-sm leading-none">{t.icon}</span>
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
                <DropdownMenuItem onClick={handleExport} className="py-2">
                  <Download className="mr-2 h-4 w-4" /> Exportar dados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportClick} className="py-2">
                  <Upload className="mr-2 h-4 w-4" /> Importar JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAlerts(true)} className="py-2">
                  <Bell className="mr-2 h-4 w-4" /> Alertas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
    </nav>
  );
}