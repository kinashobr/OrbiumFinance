import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent) => {
      setSidebarCollapsed(e.detail);
    };

    window.addEventListener("sidebar-toggle", handleSidebarToggle as EventListener);

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top App Bar – Material 3 style */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-[min(1400px,95vw)] mx-auto flex h-14 md:h-16 items-center px-3 md:px-6 gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-rounded text-xl">finance_chip</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Orbium
              </span>
              <span className="text-base md:text-lg font-semibold leading-tight">
                Visão financeira
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex w-full">
        {/* Desktop navigation drawer */}
        <Sidebar />

        <main
          className={cn(
            "flex-1 min-h-[calc(100vh-3.5rem)] px-3 md:px-6 pb-20 md:pb-8 pt-4 md:pt-6 transition-all duration-300",
            sidebarCollapsed ? "md:ml-16" : "md:ml-64"
          )}
        >
          <div className="max-w-[min(1400px,95vw)] mx-auto space-y-4">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}

