import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';
import { ThemeState } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One installed theme: its name and description, version and author, and what can be done with it.
 * The active theme offers its settings; any other offers "Activate". Everything else (disable, update,
 * details, delete) is in the "⋯" menu. Its look is the `fc-ext-row` rules of `settings.css`.
 */
export class InstalledThemeCard extends PureReactor {
  @prop declare onActivate: (slug: string) => Promise<void>;
  @prop declare onDisable: (slug: string) => Promise<void>;
  @prop declare onDelete: (slug: string, isActive: boolean) => Promise<void>;
  @prop declare onUpdate: (slug: string) => Promise<void>;
  @prop declare onNavigate: (href: string) => void;
  @prop declare theme: IInstalledThemeManifest;
  @prop declare updateVersion: string | null;
  /**
   * False for a tenant admin on a multi-tenant deployment. Gates the PLATFORM actions only — upgrade and
   * delete change the files every site renders from. Activate, disable and settings are SITE actions
   * (T3): every admin of a site may choose that site's theme from what the operator installed.
   */
  @prop declare canManage: boolean;
  /** A theme THIS site uploaded (in its own directory): the site may remove it. */
  @prop declare ownedBySite: boolean;
  @prop declare onDeleteMine: (slug: string, isActive: boolean) => Promise<void>;

  private get isActive(): boolean {
    // API JSON: `state` is a raw string, so resolve rather than compare a string to a member.
    return ThemeState.resolve(this.theme.state) === ThemeState.ACTIVE;
  }

  private get menuItems(): IDropdownItem[] {
    const { theme, isActive } = this;
    const items: IDropdownItem[] = [
      { label: AdminI18n.t('themes.manage'), icon: <FrameworkIcons.Info size={14} />, onClick: () => this.onNavigate(AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)) },
    ];
    if (isActive) items.push({ label: AdminI18n.t('themes.disable'), icon: <FrameworkIcons.Close size={14} />, onClick: () => void this.onDisable(theme.slug) });
    if (this.updateVersion && this.canManage) {
      items.push({ label: AdminI18n.t('themes.upgradeToV', { updateVersion: this.updateVersion }), icon: <FrameworkIcons.Refresh size={14} />, onClick: () => void this.onUpdate(theme.slug) });
    }
    if (this.ownedBySite) {
      items.push({ label: AdminI18n.t('themes.deleteThisSiteSTheme'), icon: <FrameworkIcons.Trash size={14} />, variant: DropdownItemVariant.DANGER, onClick: () => void this.onDeleteMine(theme.slug, isActive) });
    }
    if (this.canManage) {
      items.push({ label: AdminI18n.t('themes.delete'), icon: <FrameworkIcons.Trash size={14} />, variant: DropdownItemVariant.DANGER, onClick: () => void this.onDelete(theme.slug, isActive) });
    }
    return items;
  }

  render(): ReactNode {
    const { theme, isActive } = this;
    const pill = AdminClass.of('ext-pill');
    const meta = [`v${theme.version}`, theme.author].filter(Boolean).join(' · ');

    return (
      <div className={AdminClass.of('ext-row')}>
        <div className={AdminClass.of('ext-row__icon')}>
          {theme.iconUrl ? <img src={theme.iconUrl} alt="" /> : <FrameworkIcons.Palette size={16} />}
        </div>

        <div className={AdminClass.of('ext-row__text')}>
          <div className={AdminClass.of('ext-row__name')}>
            <AdminLink href={AdminConstants.ROUTES.THEMES.DETAIL(theme.slug)}>{theme.name}</AdminLink>
            {this.updateVersion ? <span className={`${pill} ${AdminClass.of('ext-pill--warn')}`}>{AdminI18n.t('themes.update')}</span> : null}
            {this.ownedBySite ? <span className={pill}>{AdminI18n.t('themes.thisSiteS')}</span> : null}
          </div>
          {theme.description ? <p className={AdminClass.of('ext-row__desc')} title={theme.description}>{theme.description}</p> : null}
        </div>

        <div className={AdminClass.of('ext-row__meta')} title={meta}>{meta}</div>

        <div className={AdminClass.of('ext-row__actions')}>
          {isActive
            ? <Button variant={ButtonVariant.OUTLINE} onClick={() => this.onNavigate(AdminConstants.ROUTES.THEMES.SETTINGS_TAB(theme.slug))}>{AdminI18n.t('themes.settings')}</Button>
            : <Button variant={ButtonVariant.OUTLINE} onClick={() => void this.onActivate(theme.slug)}>{AdminI18n.t('themes.activate')}</Button>}
          <Dropdown align={HorizontalAlign.RIGHT} items={this.menuItems} trigger={
            <span aria-label={AdminI18n.t('common.more')} className={AdminClass.of('ext-row__more')}>
              <FrameworkIcons.More size={16} />
            </span>
          } />
        </div>
      </div>
    );
  }
}
