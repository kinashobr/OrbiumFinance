import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeType = 
  | "brown-light" 
  | "dark-neon";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: { id: ThemeType; name: string; icon: string }[];
}

const THEMES: { id: ThemeType; name: string; icon: string }[] = [
  { id: "brown-light", name: "Marrom Claro", icon: "☀️" },
  { id: "dark-neon", name: "Dark Neon", icon: "🌙" },
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("app-theme") as ThemeType | null;

    if (saved === "brown-light" || saved === "dark-neon") {
      return saved;
    }

    // Fallback: seguir preferência do sistema
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark-neon";
    }

    return "brown-light";
  });

  useEffect(() => {
    localStorage.setItem("app-theme", theme);

    const root = document.documentElement;

    // Remove all previous theme classes
    root.classList.remove("theme-brown-light", "theme-dark-neon", "dark");

    // Add current theme class + dark helper when necessário
    root.classList.add(`theme-${theme}`);
    if (theme === "dark-neon") {
      root.classList.add("dark");
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}