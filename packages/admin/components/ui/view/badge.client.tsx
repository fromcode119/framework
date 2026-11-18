import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * A short state beside a name: paid, draft, overdue.
 *
 * FIVE tones, and they are the console's: success, warning, danger, info and neutral, each drawn from
 * the status tints in `admin.css` so a badge follows the scheme and the brand like everything else.
 * The colour-named variants a caller may still pass (`green`, `amber`, `blue`, `purple`, `gray`) are
 * names for the same five — a badge says what something IS, not which crayon was picked.
 *
 * It used to carry ten Tailwind palette strings in this file, 60 colours in all, none of which any
 * setting could reach: an emerald badge stayed emerald in a console themed otherwise, and in dark
 * mode it carried a second hardcoded set.
 */
export class Badge extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare variant?: BadgeVariant;
  @prop declare className?: string;

  /** Every variant, including the colour-named ones, resolved to one of the console's five tones. */
  private static readonly TONES: Record<string, string> = {
    success: 'success',
    green: 'success',
    warning: 'warning',
    amber: 'warning',
    danger: 'danger',
    info: 'info',
    blue: 'info',
    purple: 'info',
    gray: 'neutral',
    default: 'neutral',
  };

  render(): ReactNode {
    const value = BadgeVariant.resolve(this.variant ?? BadgeVariant.DEFAULT).value;
    const tone = Badge.TONES[value] ?? 'neutral';
    return (
      <span className={`fc-badge fc-badge--${tone} ${this.className ?? ''}`}>
        {this.children}
      </span>
    );
  }
}
