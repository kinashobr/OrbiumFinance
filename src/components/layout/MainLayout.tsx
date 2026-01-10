import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
interface MainLayoutProps {
  children: React.ReactNode;
}
export function MainLayout({
  children
}: MainLayoutProps) {
  // O novo design desktop usa uma sidebar sempre recolhida (w-24)
  const sidebarWidthClass = "lg:w-24"; 
  const mainContentMarginClass = "lg:ml-24"; 

  return <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top App Bar – Removido, agora o header é parte do Index.tsx ou Page.tsx */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm hidden md:block">
        
      </header>

      <div className="flex-1 flex w-full">
        {/* Desktop navigation drawer (sempre recolhido no novo design) */}
        <Sidebar />

        <main className={cn("flex-1 min-h-[calc(100vh)] px-3 md:px-6 pb-20 md:pb-8 pt-4 md:pt-6 transition-all duration-300", mainContentMarginClass)}>
          <div className="max-w-[min(1600px,95vw)] mx-auto space-y-4">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>;
}