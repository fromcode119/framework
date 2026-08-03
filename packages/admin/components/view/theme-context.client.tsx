import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, watch } from '@fromcode119/reactor';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';
import { ThemeContext } from '@/components/view/theme-context-store.client';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminServices } from '@/lib/admin-services';

/**
 * Publishes the admin's light/dark mode and the toggle that changes it.
 *
 * `mounted` gates the first paint: the persisted preference is only readable in the browser, so the
 * server render must not commit to a theme (it would flash the wrong one on hydration).
 */
export class ThemeProvider extends Reactor {
  private static readonly adminServices = AdminServices.getInstance();

  @prop declare children: ReactNode;

  @state private theme: IThemeContextType['theme'] = ThemeMode.LIGHT;

  @state private mounted = false;

  componentDidMount(): void {
    const savedRaw = ThemeProvider.adminServices.uiPreference.readThemePreference();
    if (savedRaw) {
      this.theme = ThemeMode.resolve(savedRaw);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.theme = ThemeMode.DARK;
    }
    this.mounted = true;
    this.applyThemeClass();
  }

  /** Replaces `componentDidUpdate` + a prevState comparison. */
  @watch('theme')
  protected onThemeChanged(): void {
    this.applyThemeClass();
  }

  private applyThemeClass(): void {
    if (!this.mounted) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(this.theme.value);
  }

  @bound
  toggleTheme(): void {
    const newTheme = this.theme === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
    this.theme = newTheme;
    ThemeProvider.adminServices.uiPreference.writeThemePreference(newTheme);
  }

  private get value(): IThemeContextType {
    return { theme: this.theme, toggleTheme: this.toggleTheme };
  }

  render(): ReactNode {
    if (!this.mounted) {
      return <div className="bg-slate-50 dark:bg-[#020617] min-h-screen" />;
    }
    return (
      <ThemeContext.context.Provider value={this.value}>
        <div className="min-h-screen transition-colors duration-300">
          {this.children}
        </div>
      </ThemeContext.context.Provider>
    );
  }
}
