import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * One titled part of a detail page's Overview (a plugin, a theme) — a heading and its content, with no
 * frame of its own: the page card is the only box, and its parts are told apart by dividers.
 */
export class DetailBox extends PureReactor {
  @prop declare title: string;
  @prop declare theme: ThemeMode;
  @prop declare action?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <section className={this.className ?? ''}>
        <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
          <h3 className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{this.title}</h3>
          {this.action ?? null}
        </div>
        {this.children}
      </section>
    );
  }
}
