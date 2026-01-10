import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  BarChart3,
  TrendingUp,
  Car,
  Download,
  Upload,
  Menu,
  Bell,
  Settings2,
  X,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";
import { SidebarAlertas } from "@/components/dashboard/SidebarAlertas";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function BottomNav() {
  const location = useLocation();
  const { exportData, importData } = useFinance();
  const { theme, setTheme, themes } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNavDrawer, setShowNavDrawer] = useState(false);

  const isPathActive = (path: string) => location.pathname === path;

  const handleExport = () => {
    exportData();
    toast.success("Arquivo finance-data.json baixado com sucesso!");
    setShowNavDrawer(false);
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
    if (result.success) {
      toast.success(result.message);
      setShowNavDrawer(false);
    } else {
      toast.error(result.message);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all duration-300",
          isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      <div className={cn(
        "p-2 rounded-2xl transition-colors",
        isPathActive(to) ? "bg-primary/10" : "bg-transparent"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </NavLink>
  );

  return (
    <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center md:hidden px-4 pointer-events-none">
      <div className="pointer-events-auto glass-card rounded-full border border-border/60 bg-card/95 shadow-2xl max-w-[500px] w-full overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center h-16 px-1">
          <NavItem to="/" icon={LayoutDashboard} label="Início" />
          <NavItem to="/receitas-despesas" icon={Receipt} label="Finanças" />
          <NavItem to="/investimentos" icon={TrendingUp} label="Investir" />
          <NavItem to="/veiculos" icon={Car} label="Bens" />

          {/* Botão Menu - Abre o Drawer */}
          <Drawer open={showNavDrawer} onOpenChange={setShowNavDrawer}>
            <DrawerTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-1 text-muted-foreground",
                  showNavDrawer && "text-primary"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors", showNavDrawer && "bg-primary/10")}>
                  <Menu className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">Mais</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="rounded-t-[2rem] border-t-border bg-card max-h-[85vh]">
              <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mt-3 mb-2" />
              
              <DrawerHeader className="px-6 pb-2">
                <DrawerTitle className="text-left text-lg font-bold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Menu de Opções
                </DrawerTitle>
              </DrawerHeader>

              <div className="px-6 py-4 space-y-6 overflow-y-auto hide-scrollbar-mobile pb-10">
                {/* Atalhos Secundários */}
                <div className="grid grid-cols-2 gap-3">
                  <NavLink
                    to="/emprestimos"
                    onClick={() => setShowNavDrawer(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/30 border border-border/50 active:bg-muted"
                  >
                    <CreditCard className="w-6 h-6 text-warning" />
                    <span className="text-xs font-bold">Empréstimos</span>
                  </NavLink>
                  <NavLink
                    to="/relatorios"
                    onClick={() => setShowNavDrawer(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/30 border border-border/50 active:bg-muted"
                  >
                    <BarChart3 className="w-6 h-6 text-info" />
                    <span className="text-xs font-bold">Relatórios</span>
                  </NavLink>
                </div>

                <Separator />

                {/* Seção de Temas */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Palette className="w-3 h-3" /> Aparência
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          "flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-medium transition-all",
                          theme === t.id 
                            ? "bg-primary text-primary-foreground border-primary shadow-lg" 
                            : "bg-muted/50 text-muted-foreground border-border"
                        )}
                      >
                        <span>{t.icon}</span>
                        {t.id === "system" ? "Auto" : t.id === "brown-light" ? "Claro" : "Escuro"}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Dados e Alertas */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">Ações de Dados</p>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start h-12 rounded-2xl border-border/60 gap-3"
                      onClick={handleExport}
                    >
                      <div className="p-1.5 rounded-lg bg-success/10 text-success">
                        <Download className="w-4 h-4" />
                      </div>
                      Exportar Backup (.json)
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start h-12 rounded-2xl border-border/60 gap-3"
                      onClick={handleImportClick}
                    >
                      <div className="p-1.5 rounded-lg bg-info/10 text-info">
                        <Upload className="w-4 h-4" />
                      </div>
                      Importar Backup
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Alertas integrados na gaveta */}
                <div className="space-y-3 pb-4">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Bell className="w-3 h-3" /> Notificações do Sistema
                  </p>
                  <div className="bg-muted/20 rounded-3xl p-2 border border-border/40">
                    <SidebarAlertas collapsed={false} />
                  </div>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </nav>
  );
}