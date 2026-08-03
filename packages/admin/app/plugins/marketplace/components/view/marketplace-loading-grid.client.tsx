import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class MarketplaceLoadingGrid extends PureReactor {
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const theme = this.theme;
    return (
      <>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`h-64 ${AdminClass.SURFACE} animate-pulse ${theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white border border-slate-100 shadow-sm'}`} />
        ))}
      </>
    );
  }
}
