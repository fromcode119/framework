import type { HTMLAttributes, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class Card extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare noPadding?: boolean;
  @prop declare title?: string;
  @prop declare icon?: ReactNode;

  private get rest(): HTMLAttributes<HTMLDivElement> {
    const { children, className, noPadding, title, icon, ...props } = this.props as Record<string, unknown>;
    return props as HTMLAttributes<HTMLDivElement>;
  }

  render(): ReactNode {
    const className = this.className ?? "";
    const noPadding = this.noPadding ?? false;
    return (
      <div
        {...this.rest}
        // `AdminClass.SURFACE` IS the treatment (see admin.css) — Card does not redefine it, it renders it, so a
        // bespoke panel that opts into the same class is guaranteed to match this one exactly.
        className={`${AdminClass.SURFACE} text-[var(--card-foreground)] ${noPadding ? '' : 'p-4'} ${className}`}
      >
        {this.title && <h3 className="mb-3 text-[13px] font-semibold tracking-tight text-[var(--card-foreground)]">{this.title}</h3>}
        {this.children}
      </div>
    );
  }
}
