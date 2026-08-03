import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';

/** Themed loading spinner. Hook-free class: color mode from the admin runtime context. */
export class Loader extends AdminComponent {
  @prop declare label?: string;
  @prop declare className?: string;
  @prop declare fullPage?: boolean;

  render(): ReactNode {
    const label = this.label ?? 'Synchronizing Data';
    const className = this.className ?? '';
    const fullPage = this.fullPage ?? false;
    const theme = this.theme;

    const content = (
      <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
        <div className="relative">
          <div className={`h-16 w-16 border-4 rounded-full animate-spin transition-colors duration-500 ${
            theme === ThemeMode.DARK ? 'border-indigo-500/10 border-t-indigo-500' : 'border-indigo-100 border-t-indigo-600'
          }`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-8 w-8 rounded-xl animate-pulse transition-colors duration-500 ${
              theme === ThemeMode.DARK ? 'bg-indigo-500/10' : 'bg-indigo-50'
            }`}></div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className={`font-semibold text-[10px] tracking-widest animate-pulse transition-colors duration-500 ${
            theme === ThemeMode.DARK ? 'text-indigo-400' : 'text-indigo-600'
          }`}>
            {label}
          </p>
          <div className="flex gap-1.5 mt-1">
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${theme === ThemeMode.DARK ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${theme === ThemeMode.DARK ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
            <div className={`h-1.5 w-1.5 rounded-full animate-bounce ${theme === ThemeMode.DARK ? 'bg-indigo-500' : 'bg-indigo-600'}`}></div>
          </div>
        </div>
      </div>
    );

    if (fullPage) {
      return (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl ${
          theme === ThemeMode.DARK ? 'bg-slate-950/60' : 'bg-white/60'
        }`}>
          {content}
        </div>
      );
    }

    return (
      <div className="py-20 flex items-center justify-center">
        {content}
      </div>
    );
  }
}
