import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * The single compact admin page header — a sticky bar with an optional back button, the title, one
 * line under it and the actions on the right. EVERY admin page (incl. plugin pages via
 * PluginPageHeader) renders this, and its look is the `fc-page-header` rules of `settings.css`, so a
 * change there changes every header.
 *
 * It draws no icon: a coloured badge before every title said nothing the title and the menu did not,
 * and pushed the title off its column. A page still passes `icon` where it was written with one.
 */
export class CompactPageHeader extends PureReactor {
  /** Accepted for backward-compat and ignored — the look comes from `settings.css`. */
  @prop declare theme?: ThemeMode;
  /** Accepted for backward-compat and ignored — the header draws no icon. */
  @prop declare icon?: ReactNode;
  /**
   * The mark of the THING the page is about (a plugin's own icon), drawn as a small tile before the
   * title. Only a page about one object passes it; section pages keep the plain title.
   */
  @prop declare mark?: ReactNode;
  @prop declare title: ReactNode;
  @prop declare subtitle?: ReactNode;
  /** Render a back button linking here (takes precedence over onBack). */
  @prop declare backHref?: string;
  /** Render a back button calling this handler. */
  @prop declare onBack?: () => void;
  /** Right-side action buttons. */
  @prop declare actions?: ReactNode;

  private backButton(): ReactNode {
    const { backHref, onBack } = this;
    if (!backHref && !onBack) return null;
    const cls = AdminClass.of('page-header__back');
    const inner = <FrameworkIcons.Left size={16} strokeWidth={2} />;
    if (backHref) return <AdminLink href={backHref} className={cls}>{inner}</AdminLink>;
    return <button type="button" onClick={onBack} className={cls}>{inner}</button>;
  }

  render(): ReactNode {
    const { title, subtitle, actions } = this;
    return (
      <div className={AdminClass.of('page-header')}>
        <div className={AdminClass.of('page-header__inner')}>
          <div className={AdminClass.of('page-header__main')}>
            {this.backButton()}
            {this.mark ? <span className={AdminClass.of('page-header__mark')} aria-hidden="true">{this.mark}</span> : null}
            <div className={AdminClass.of('page-header__text')}>
              <h1 className={AdminClass.of('page-header__title')}>{title}</h1>
              {subtitle && <p className={AdminClass.of('page-header__subtitle')}>{subtitle}</p>}
            </div>
          </div>
          {actions && <div className={AdminClass.of('page-header__actions')}>{actions}</div>}
        </div>
      </div>
    );
  }
}
