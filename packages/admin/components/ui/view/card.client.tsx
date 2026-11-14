import type { HTMLAttributes, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { twMerge } from 'tailwind-merge';
import { AdminClass } from '@/lib/admin-class';

export class Card extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare noPadding?: boolean;
  @prop declare title?: string;
  /** One line under the title saying what the card holds. */
  @prop declare description?: ReactNode;
  @prop declare icon?: ReactNode;

  private get rest(): HTMLAttributes<HTMLDivElement> {
    const { children, className, noPadding, title, description, icon, ...props } = this.props as Record<string, unknown>;
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
        // Merged, not concatenated: a caller's `p-0`/`p-6` sat beside the default `p-4` at equal
        // specificity, so whichever the stylesheet emitted later won — every media tile rendered its
        // thumbnail inset in a padded box. The caller's padding now replaces the default.
        className={twMerge(`${AdminClass.SURFACE} text-[var(--card-foreground)]`, noPadding ? '' : 'p-4', className)}
      >
        {/* The head's look is `settings.css` (`fc-card__*`), so a card holding setting rows and any other
            card share one title style. */}
        {this.title ? (
          <div className={AdminClass.of('card__head')}>
            <h3 className={AdminClass.of('card__title')}>{this.title}</h3>
            {this.description ? <p className={AdminClass.of('card__desc')}>{this.description}</p> : null}
          </div>
        ) : null}
        {this.children}
      </div>
    );
  }
}
