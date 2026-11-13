import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Icon } from '@/components/view/icon.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { NavUtils } from '@/lib/nav-utils';
import { NavItem } from '@/app/components/view/sidebar-nav-item.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminNavText } from '@/lib/i18n/admin-nav-text';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

/**
 * The console's menu: one column of sections with no group headings, and Settings at its foot.
 *
 * A section's pages — its own menu entries and the panel entries of the page you are on — are drawn
 * indented under it only while you are inside it. The console's upkeep (people, extensions, activity,
 * the platform's tools) is listed under Settings the same way, so the column above it is the work a
 * site is run from. Nothing is hidden: every page is one click from the section that holds it.
 */
export class SidebarNavGroups extends PureReactor {
  @prop declare isAdmin?: boolean;
  @prop declare isMini?: boolean;
  @prop declare pathname: string;
  @prop declare groupedMenu: Record<string, any[]>;
  /** The panel entries of the section you are in; drawn under it. */
  @prop declare sectionPages?: any[];
  @prop declare normalizedActivePrimaryPathOverride: string;
  @prop declare normalizedActiveChildPathOverride: string;
  @prop declare footerSettingsItem: any;
  @prop declare onClose?: () => void;
  /** Rendered between the sections and Settings (the `admin.layout.sidebar.bottom` slot). */
  @prop declare beforeSettings?: ReactNode;

  /** Activity is the console's own page for administrators; it is added when the metadata did not list it. */
  private withActivity(items: any[]): any[] {
    const activity = NavUtils.normalizePath(AdminConstants.ROUTES.ACTIVITY);
    if (!this.isAdmin || items.some((item) => NavUtils.normalizePath(item.path) === activity)) return items;
    return [...items, { label: AdminI18n.t('nav.items.activity'), path: AdminConstants.ROUTES.ACTIVITY, icon: 'Activity', pluginSlug: 'system' }];
  }

  private isActive(item: any, siblings: any[]): boolean {
    const override = this.normalizedActivePrimaryPathOverride;
    if (override) return NavUtils.normalizePath(item.path) === override;
    return NavUtils.isPathActive(this.pathname, item.path, siblings.map((entry) => entry.path));
  }

  private renderItem(item: any, siblings: any[], children?: any[]): ReactNode {
    const active = this.isActive(item, siblings);
    return (
      <NavItem
        key={`${item.pluginSlug || 'system'}-${item.path}`}
        icon={<Icon name={item.icon || 'Package'} size={18} />}
        label={AdminNavText.menuLabel(item)}
        href={item.path}
        active={active}
        onClick={this.onClose}
        children={children ?? item.children}
        subItems={active ? this.sectionPages : undefined}
        isMini={this.isMini}
        pluginSlug={item.pluginSlug}
        activePathOverride={this.normalizedActiveChildPathOverride || this.normalizedActivePrimaryPathOverride}
      />
    );
  }

  render(): ReactNode {
    const settingsItem = this.footerSettingsItem;
    const { main, settingsArea } = SidebarMenuService.sections(this.groupedMenu, settingsItem?.path ?? '');
    const upkeep = this.withActivity(settingsArea);

    return (
      <>
        <div className="fc-nav-list">{main.map((item) => this.renderItem(item, main))}</div>
        {this.beforeSettings}
        <div className="fc-nav-foot">
          {settingsItem
            ? this.renderItem(settingsItem, [settingsItem], [...(settingsItem.children || []), ...upkeep])
            : upkeep.map((item) => this.renderItem(item, upkeep))}
        </div>
      </>
    );
  }
}
