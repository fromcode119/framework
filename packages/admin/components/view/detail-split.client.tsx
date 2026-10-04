import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * A detail page's Overview body: what the thing is and does in the main column, its facts in a narrow
 * About column on the right — both inside the page card, told apart by a hairline, never by boxes. On a
 * phone the About column follows the main one.
 */
export class DetailSplit extends PureReactor {
  @prop declare main: ReactNode;
  @prop declare aside: ReactNode;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6 p-6">{this.main}</div>
        <aside className={`space-y-6 border-t p-6 md:border-l md:border-t-0 ${dark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-100 bg-slate-50/70'}`}>
          {this.aside}
        </aside>
      </div>
    );
  }
}
