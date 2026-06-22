import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Icon } from '@/components/icon';
import { AdminConstants } from '@/lib/constants';
import { NavUtils } from '@/lib/nav-utils';
import { NavItem } from './sidebar-nav-item';
import type { SidebarNavGroupsProps } from './sidebar-nav-groups.interfaces';

const {
  Activity = () => null,
} = (FrameworkIcons || {}) as any;

export class SidebarNavGroups extends React.Component<SidebarNavGroupsProps> {
  render(): React.ReactNode {
    const props = this.props;
    const {
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
      onHoverPreviewPathChange,
    } = props;

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
            <React.Fragment key={group}>
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
                    onHoverPreviewStart={(path) => onHoverPreviewPathChange?.(path)}
                    onHoverPreviewEnd={() => onHoverPreviewPathChange?.('')}
                    activePathOverride={normalizedActiveChildPathOverride || normalizedActivePrimaryPathOverride}
                  />
                ))
              )}
            </React.Fragment>
          );
        })}

        {/* If Core group doesn't exist for some reason, ensure basic nav is there */}
        {!groupedMenu['core'] && (
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

        <div className="mt-auto pt-4 space-y-1">
          {!isMini && (
            <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1">
              System
            </div>
          )}
          {(!collapsedGroups.includes('system') || isMini) && (
            <>
              <NavItem icon={<Activity size={18}/>} label="Activity" href={AdminConstants.ROUTES.ACTIVITY} persistenceKey={`system:${AdminConstants.ROUTES.ACTIVITY}`} active={pathname.startsWith(AdminConstants.ROUTES.ACTIVITY)} onClick={onClose} isMini={isMini} />
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
                  onHoverPreviewStart={(path) => onHoverPreviewPathChange?.(path)}
                  onHoverPreviewEnd={() => onHoverPreviewPathChange?.('')}
                />
              )}
            </>
          )}
        </div>
      </>
    );
  }
}
