import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Icon } from '@/components/view/icon.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { NavUtils } from '@/lib/nav-utils';
import { NavItem } from '@/app/components/view/sidebar-nav-item.client';
export class SidebarNavGroups extends PureReactor {
  @prop declare isAdmin?: boolean;
  @prop declare isMini?: boolean;
  @prop declare pathname: string;
  @prop declare sortedGroups: string[];
  @prop declare groupedMenu: Record<string, any[]>;
  @prop declare groupLabels: Record<string, string>;
  @prop declare collapsedGroups: string[];
  @prop declare plugins: any[];
  @prop declare previewablePaths?: string[];
  @prop declare hoverPreviewPath?: string;
  @prop declare activeSecondaryAnchorPath?: string;
  @prop declare normalizedActivePrimaryPathOverride: string;
  @prop declare normalizedActiveChildPathOverride: string;
  @prop declare footerSettingsItem: any;
  @prop declare footerSettingsIsGroup: boolean;
  @prop declare onClose?: () => void;
  @prop declare onHoverPreviewPathChange?: (path: string) => void;

  @bound handleHoverPreviewStart(path: string): void {
    this.onHoverPreviewPathChange?.(path);
  }

  @bound handleHoverPreviewEnd(): void {
    this.onHoverPreviewPathChange?.('');
  }

  render(): ReactNode {
    const {
      isAdmin,
      isMini,
      pathname,
      sortedGroups,
      groupedMenu,
      groupLabels,
      collapsedGroups,
      plugins,
      previewablePaths,
      hoverPreviewPath,
      activeSecondaryAnchorPath,
      normalizedActivePrimaryPathOverride,
      normalizedActiveChildPathOverride,
      footerSettingsItem,
      footerSettingsIsGroup,
      onClose,
    } = this;

    return (
      <>
        {sortedGroups.map((group, groupIdx) => {
          const items = groupedMenu[group] || [];
          const displayGroup = groupLabels[group] || NavUtils.getMenuGroupMeta(group).label;
          const isCollapsed = collapsedGroups.includes(group);

          // If a group has only one item and that item is a group wrapper (dropdown),
          // we should skip the redundant section header.
          const isRedundantHeader = !isMini && items.length === 1 && items[0].isGroup && items[0].label.toLowerCase() === group;

          return (
            <Fragment key={group}>
              {!isMini && !isRedundantHeader && (
                <div className={`px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1 ${groupIdx === 0 ? 'mt-2' : 'mt-4'}`}>
                  {displayGroup}
                </div>
              )}
              {isMini && groupIdx > 0 && (
                <div className="flex justify-center py-4">
                  <div className="w-8 h-px bg-slate-100 dark:bg-slate-800/60" />
                </div>
              )}
              {(!isCollapsed || isMini) && (
                items.map((item, idx) => (
                  <NavItem
                    key={`${item.pluginSlug || 'system'}-${item.path}-${idx}`}
                    icon={<Icon name={item.icon || 'Package'} size={18} />}
                    label={item.label}
                    href={item.path}
                    persistenceKey={`${item.pluginSlug || 'system'}:${item.path}`}
                    active={normalizedActivePrimaryPathOverride ? NavUtils.normalizePath(item.path) === normalizedActivePrimaryPathOverride : NavUtils.isPathActive(pathname, item.path, items.map((entry) => entry.path))}
                    isAnchoredToSecondary={NavUtils.normalizePath(item.path) === NavUtils.normalizePath(activeSecondaryAnchorPath)}
                    onClick={onClose}
                    children={item.children}
                    isMini={isMini}
                    isGroupHeader={item.isGroup}
                    version={plugins.find(p => p.slug === item.pluginSlug)?.version}
                    canHoverPreview={(previewablePaths || []).includes(NavUtils.normalizePath(item.path))}
                    showHoverPreview={NavUtils.normalizePath(item.path) === NavUtils.normalizePath(hoverPreviewPath) && (previewablePaths || []).includes(NavUtils.normalizePath(item.path))}
                    preserveActiveAnchor={NavUtils.normalizePath(item.path) === NavUtils.normalizePath(activeSecondaryAnchorPath)}
                    onHoverPreviewStart={this.handleHoverPreviewStart}
                    onHoverPreviewEnd={this.handleHoverPreviewEnd}
                    activePathOverride={normalizedActiveChildPathOverride || normalizedActivePrimaryPathOverride}
                  />
                ))
              )}
            </Fragment>
          );
        })}

        {/* If Core group doesn't exist for some reason, ensure basic nav is there — ADMINS ONLY.
            For scoped-staff users the core group is intentionally absent (Dashboard/Plugins are
            admin-only), so this fallback must not re-inject those system links for them. */}
        {isAdmin && !groupedMenu['core'] && (
          <>
            {!isMini && (
              <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1.5 mt-4">
                Core
              </div>
            )}
            {(!collapsedGroups.includes('core-fallback') || isMini) && (
              <>
                <NavItem icon={<Icon name="Dashboard" size={18} />} label="Dashboard" href={AdminConstants.ROUTES.ROOT} persistenceKey={`system:${AdminConstants.ROUTES.ROOT}`} active={pathname === AdminConstants.ROUTES.ROOT} onClick={onClose} isMini={isMini} />
                <NavItem icon={<Icon name="Package" size={18} />} label="Plugins" href={AdminConstants.ROUTES.PLUGINS.ROOT} persistenceKey={`system:${AdminConstants.ROUTES.PLUGINS.ROOT}`} active={pathname === AdminConstants.ROUTES.PLUGINS.ROOT} onClick={onClose} isMini={isMini} />
              </>
            )}
          </>
        )}

        {/* System section: Activity is admin-only; Settings only appears if it survived nav
            authorization (admins). Hide the whole section for scoped users who have neither. */}
        {(isAdmin || footerSettingsItem) && (
        <div className="mt-auto pt-4 space-y-1">
          {!isMini && (
            <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1">
              System
            </div>
          )}
          {(!collapsedGroups.includes('system') || isMini) && (
            <>
              {isAdmin && (
                <NavItem icon={<FrameworkIcons.Activity size={18}/>} label="Activity" href={AdminConstants.ROUTES.ACTIVITY} persistenceKey={`system:${AdminConstants.ROUTES.ACTIVITY}`} active={pathname.startsWith(AdminConstants.ROUTES.ACTIVITY)} onClick={onClose} isMini={isMini} />
              )}
              {footerSettingsItem && (
                <NavItem
                  icon={<Icon name={footerSettingsItem.icon || 'Settings'} size={18} />}
                  label={footerSettingsItem.label}
                  href={footerSettingsItem.path}
                  persistenceKey={`${footerSettingsItem.pluginSlug || 'system'}:${footerSettingsItem.path}`}
                  active={normalizedActivePrimaryPathOverride ? NavUtils.normalizePath(footerSettingsItem.path) === normalizedActivePrimaryPathOverride : NavUtils.isPathActive(pathname, footerSettingsItem.path, [footerSettingsItem.path])}
                  isAnchoredToSecondary={NavUtils.normalizePath(footerSettingsItem.path) === NavUtils.normalizePath(activeSecondaryAnchorPath)}
                  onClick={onClose}
                  children={footerSettingsItem.children}
                  isMini={isMini}
                  isGroupHeader={footerSettingsIsGroup}
                  version={plugins.find(p => p.slug === footerSettingsItem.pluginSlug)?.version}
                  canHoverPreview={(previewablePaths || []).includes(NavUtils.normalizePath(footerSettingsItem.path))}
                  showHoverPreview={NavUtils.normalizePath(footerSettingsItem.path) === NavUtils.normalizePath(hoverPreviewPath) && (previewablePaths || []).includes(NavUtils.normalizePath(footerSettingsItem.path))}
                  preserveActiveAnchor={NavUtils.normalizePath(footerSettingsItem.path) === NavUtils.normalizePath(activeSecondaryAnchorPath)}
                  onHoverPreviewStart={this.handleHoverPreviewStart}
                  onHoverPreviewEnd={this.handleHoverPreviewEnd}
                />
              )}
            </>
          )}
        </div>
        )}
      </>
    );
  }
}
