import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  BarChart3,
  TrendingUp,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Receitas", to: "/receitas-despesas", icon: Receipt },
  { label: "Empréstimos", to: "/emprestimos", icon: CreditCard },
  { label: "Investimentos", to: "/investimentos", icon: TrendingUp },
  { label: "Veículos", to: "/veiculos", icon: Car },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
      <div className="mx-auto flex h-14 max-w-[min(1400px,95vw)] items-center justify-between px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-current transition-colors",
                  active && "bg-primary/10"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="leading-none truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
