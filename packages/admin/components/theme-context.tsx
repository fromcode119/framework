"use client";

import React from "react";
import type { ThemeContextType } from './theme-context.interfaces';
import { ThemeContext } from './theme-context-store';
import { AdminServices } from '@/lib/admin-services';

const adminServices = AdminServices.getInstance();

export class ThemeProvider extends React.Component<{ children: React.ReactNode }, { theme: ThemeContextType['theme']; mounted: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { theme: 'light', mounted: false };
    this.toggleTheme = this.toggleTheme.bind(this);
  }

  componentDidMount(): void {
    const saved = adminServices.uiPreference.readThemePreference() as ThemeContextType['theme'];
    if (saved) {
      this.setState({ theme: saved });
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      this.setState({ theme: "dark" });
    }
    this.setState({ mounted: true }, () => this.applyThemeClass());
  }

  componentDidUpdate(_prevProps: { children: React.ReactNode }, prevState: { theme: ThemeContextType['theme']; mounted: boolean }): void {
    if (this.state.mounted && prevState.theme !== this.state.theme) this.applyThemeClass();
  }

  private applyThemeClass(): void {
    if (!this.state.mounted) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(this.state.theme);
  }

  toggleTheme(): void {
    const newTheme = this.state.theme === "dark" ? "light" : "dark";
    this.setState({ theme: newTheme });
    adminServices.uiPreference.writeThemePreference(newTheme);
  }

  render(): React.ReactNode {
    if (!this.state.mounted) {
      return <div className="bg-slate-50 dark:bg-[#020617] min-h-screen" />;
    }
    return (
      <ThemeContext.context.Provider value={{ theme: this.state.theme, toggleTheme: this.toggleTheme }}>
        <div className="min-h-screen transition-colors duration-300">
          {this.props.children}
        </div>
      </ThemeContext.context.Provider>
    );
  }
}
