import type { ReactNode } from 'react';

import { SidebarNavPart } from '@/app/enums/sidebar-nav-part.enum';
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
  /** What the menu's search holds; while it holds anything the menu is the pages whose names match. */
  @prop declare query?: string;
  /** The sections (scrolling) or Settings (pinned at the sidebar's foot). */
  @prop declare part?: SidebarNavPart;

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

  /** Every page the menu reaches, sections and their pages alike, whose name holds the query. */
  private renderMatches(all: any[], query: string): ReactNode {
    const needle = query.trim().toLocaleLowerCase();
    const seen = new Set<string>();
    const pages = all.flatMap((item) => [item, ...(item.children || []).map((child: any) => ({ ...child, icon: child.icon || item.icon, pluginSlug: child.pluginSlug || item.pluginSlug }))])
      .filter((item) => {
        const path = NavUtils.normalizePath(item.path);
        if (!path || seen.has(path) || !AdminNavText.menuLabel(item).toLocaleLowerCase().includes(needle)) return false;
        seen.add(path);
        return true;
      });
    if (!pages.length) return <p className="fc-nav-empty">{AdminI18n.t('shell.nav.noMatches', { query: query.trim() })}</p>;
    return <div className="fc-nav-list">{pages.map((item) => this.renderItem({ ...item, children: [] }, pages, []))}</div>;
  }

  render(): ReactNode {
    const settingsItem = this.footerSettingsItem;
    const { main, settingsArea } = SidebarMenuService.sections(this.groupedMenu, settingsItem?.path ?? '');
    const upkeep = this.withActivity(settingsArea);
    const settingsChildren = [...(settingsItem?.children || []), ...upkeep];

    if (this.part === SidebarNavPart.FOOT) {
      if (this.query?.trim()) return null;
      return (
        <div className="fc-nav-foot">
          {settingsItem
            ? this.renderItem(settingsItem, [settingsItem], settingsChildren)
            : upkeep.map((item) => this.renderItem(item, upkeep))}
        </div>
      );
    }
    if (this.query?.trim()) {
      return this.renderMatches([...main, ...(settingsItem ? [{ ...settingsItem, children: settingsChildren }] : upkeep)], this.query);
    }
    return (
      <>
        <div className="fc-nav-list">{main.map((item) => this.renderItem(item, main))}</div>
        {this.beforeSettings}
      </>
    );
  }
}
