import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

export class SectionCard extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare icon?: ReactNode;
  @prop declare actions?: ReactNode;
  @prop declare children: ReactNode;
  @prop declare noPadding?: boolean;
  @prop declare className?: string;
  /** Show the subtitle as the title's hint instead of a second line (dense surfaces such as the dashboard). */
  @prop declare subtitleAsHint?: boolean;

  /**
   * The surface IS `AdminClass.SURFACE` — background, border and shadow come from it, so this card
   * follows the console (and its shadow setting) instead of painting its own white. It used to add
   * `bg-white border-slate-200/70 shadow-sm` and an indigo icon tile in the markup, which is why a
   * plugin's dashboard stayed light-grey and square-shadowed whatever the console was set to. The
   * look lives in `admin.css` (`.fc-section-card__*`).
   */
  render(): ReactNode {
    const { title, subtitle, icon, actions, children } = this;
    const noPadding = this.noPadding ?? false;
    const className = this.className ?? '';
    return (
      <section className={`fc-section-card ${AdminClass.SURFACE} overflow-hidden ${className}`}>
        <header className="fc-section-card__head">
          <div className="fc-section-card__name">
            {icon && <div className="fc-section-card__icon">{icon}</div>}
            <div className="min-w-0">
              <h2 title={this.subtitleAsHint ? subtitle : undefined} className="fc-section-card__title">{title}</h2>
              {subtitle && !this.subtitleAsHint && (
                <p className="fc-section-card__subtitle">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="fc-section-card__actions">{actions}</div>}
        </header>
        {noPadding ? children : <div className="fc-section-card__body">{children}</div>}
      </section>
    );
  }
}
