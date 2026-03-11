"use client";

import React, { useState, useEffect } from "react";
import type { ThemeContextType } from './theme-context.interfaces';
import { ThemeContext } from './theme-context-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeContextType['theme']>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as ThemeContextType['theme'];
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme, mounted]);

  if (!mounted) {
    return <div className="bg-slate-50 dark:bg-[#020617] min-h-screen" />;
  }

  return (
    <ThemeContext.context.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen transition-colors duration-300">
        {children}
      </div>
    </ThemeContext.context.Provider>
  );
}
