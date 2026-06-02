"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { AuthHooks } from '@/components/use-auth';
import { Icon } from '@/components/icon';
import { FrameworkIcons } from '@fromcode119/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { AdminConstants } from '@/lib/constants';
import { NavUtils } from '@/lib/nav-utils';
import { AdminServices } from '@/lib/admin-services';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';

const ATLANTIS_MARK_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-mark-indigo.png');

const { 
  Close = () => null, 
  Zap = () => null,
  Down = () => null,
  Left = () => null,
  // System-level icons still used directly
  Activity = () => null
} = (FrameworkIcons || {}) as any;

const adminServices = AdminServices.getInstance();

interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  persistenceKey?: string;
  active?: boolean;
  isAnchoredToSecondary?: boolean;
  onClick?: () => void;
  children?: any[];
  isMini?: boolean;
  isGroupHeader?: boolean;
  version?: string;
  canHoverPreview?: boolean;
  showHoverPreview?: boolean;
  preserveActiveAnchor?: boolean;
  onHoverPreviewStart?: (path: string) => void;
  onHoverPreviewEnd?: () => void;
}

const NavItem = ({ icon, label, href, persistenceKey, active, isAnchoredToSecondary, onClick, children, isMini, isGroupHeader, version, canHoverPreview, showHoverPreview, preserveActiveAnchor, onHoverPreviewStart, onHoverPreviewEnd }: NavItemProps) => {
  const { theme } = ThemeHooks.useTheme();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const hasChildren = children && children.length > 0;
  
  const childPaths = React.useMemo(
    () => (children || []).map((child) => NavUtils.normalizePath(child.path)).filter(Boolean),
    [children]
  );
  const storageKey = React.useMemo(
    () => String(persistenceKey || href || label).trim(),
    [href, label, persistenceKey],
  );
  const activeChildPath = React.useMemo(
    () => NavUtils.resolveBestMatchPath(pathname, childPaths as string[]) || '',
    [pathname, childPaths]
  );
  const isChildActive = !!activeChildPath;
  const displayLabel = label;

  const [expanded, setExpanded] = React.useState(!!(active || isChildActive));

  // Load persistence state
  React.useEffect(() => {
    if (storageKey) {
      const saved = adminServices.uiPreference.readNavExpanded(storageKey);
      if (saved !== null) {
        setExpanded(saved);
      }
    }
  }, [storageKey]);

  // Save persistence state
  React.useEffect(() => {
    if (storageKey) {
      adminServices.uiPreference.writeNavExpanded(storageKey, expanded);
    }
  }, [expanded, storageKey]);

  // Auto-expand when a child becomes active
  React.useEffect(() => {
    if (isChildActive) {
      setExpanded(true);
    }
  }, [isChildActive]);

  // The parent is "highlighted" if it is active AND NO CHILD is active.
  const isHighlighted = active && !isChildActive;
  const isPreviewingSecondary = Boolean(showHoverPreview && !isHighlighted && !isChildActive);

  // If it's a group header, clicking should just toggle expansion
  const handleClick = (e: React.MouseEvent) => {
    if (isGroupHeader || (hasChildren && !expanded)) {
      if (isGroupHeader) {
        e.preventDefault();
      }
      setExpanded(!expanded);
    }
    onClick?.();
  };

  return (
    <div className="relative flex flex-col">
      <div
        className={`flex items-center group relative ${isMini ? 'justify-center w-full' : 'gap-0.5'}`}
        onMouseEnter={!isMini ? () => onHoverPreviewStart?.(href) : undefined}
        onMouseLeave={!isMini ? onHoverPreviewEnd : undefined}
      >
        <Link
          href={isGroupHeader ? '#' : href}
          onClick={handleClick}
          className={`flex items-center transition-colors duration-150 ${
            isHighlighted
              ? 'bg-indigo-600 text-white'
              : isPreviewingSecondary
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
              : isChildActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
          } ${isMini ? 'flex-col justify-center w-14 h-14 rounded-lg gap-1' : 'flex-1 justify-between px-2.5 py-1.5 rounded-md'}`}
        >
          <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-2.5'}`}>
            <span className={`${isHighlighted ? 'text-white' : isPreviewingSecondary ? 'text-indigo-500 dark:text-indigo-300' : isChildActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors'} flex items-center justify-center shrink-0`}>
              {icon}
            </span>

            {!isMini && (
              <div className="flex flex-col">
                <span className={`text-[12px] ${isHighlighted || isChildActive ? 'font-semibold' : 'font-medium'} tracking-[-0.01em] whitespace-nowrap`}>
                  {displayLabel}
                </span>
                {version && (
                  <span className={`text-[8px] font-mono mt-px opacity-50 ${isHighlighted ? 'text-white' : 'text-slate-400'}`}>
                    v{version}
                  </span>
                )}
              </div>
            )}
          </div>

          {isMini && (
            <span className={`text-[8px] font-semibold tracking-tight text-center leading-none px-1 ${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'}`}>
              {displayLabel.length > 9 ? displayLabel.substring(0, 8) + '..' : displayLabel}
            </span>
          )}

          {hasChildren && !isMini && (
            <Down
              size={14}
              className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${
                isHighlighted ? 'text-white/60' : 'text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400'
              }`}
              onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
            />
          )}
        </Link>
      </div>

      {hasChildren && expanded && !isMini && (
        <div className="relative ml-[18px] mt-0.5 mb-1 flex flex-col gap-px border-l border-slate-200/70 pl-2 dark:border-slate-800">
          {children.map((child) => {
            const isSubActive = NavUtils.normalizePath(child.path) === activeChildPath;
            return (
              <Link
                key={child.path}
                href={child.path}
                onClick={onClick}
                className={`relative flex items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-[12px] transition-colors duration-150 ${
                  isSubActive
                    ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-slate-400 hover:bg-slate-100/70 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
                }`}
              >
                {isSubActive && (
                  <span className="absolute left-[-9px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-indigo-500" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap tracking-[-0.01em]">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function Sidebar({ isOpen, onClose, isMini, onMiniToggle, onActiveContextChange, activeSecondaryAnchorPath, hoverPreviewPath, previewablePaths, onHoverPreviewPathChange, inlineSecondaryContext, inlineSecondaryItems, inlineSecondarySourceLabel, showInlineSecondary, activePrimaryPathOverride, onPreviewRegionEnter, onPreviewRegionLeave }: { 
  isOpen?: boolean, 
  onClose?: () => void,
  isMini?: boolean,
  onMiniToggle?: () => void,
  onActiveContextChange?: (contextId: string) => void,
  activeSecondaryAnchorPath?: string,
  hoverPreviewPath?: string,
  previewablePaths?: string[],
  onHoverPreviewPathChange?: (path: string) => void,
  inlineSecondaryContext?: any,
  inlineSecondaryItems?: any[],
  inlineSecondarySourceLabel?: string,
  showInlineSecondary?: boolean,
  activePrimaryPathOverride?: string,
  onPreviewRegionEnter?: () => void,
  onPreviewRegionLeave?: () => void,
}) {
  const { menuItems, plugins, settings } = ContextHooks.usePlugins();
  const { theme } = ThemeHooks.useTheme();
  const { user } = AuthHooks.useAuth();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const platformName = React.useMemo(
    () => PlatformBrandingService.resolvePlatformName(settings as Record<string, unknown> | null | undefined),
    [settings]
  );
  const normalizedActivePrimaryPathOverride = React.useMemo(() => NavUtils.normalizePath(activePrimaryPathOverride), [activePrimaryPathOverride]);

  const [collapsedGroups, setCollapsedGroups] = React.useState<string[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Lock body scroll on mobile when sidebar is open so the page doesn't scroll
  // behind the overlay. On desktop the sidebar is always visible (lg:translate-x-0)
  // so isOpen is only ever true from the mobile burger button.
  React.useEffect(() => {
    if (!isOpen) return;
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;
    if (mq?.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Load state from localStorage on mount
  React.useEffect(() => {
    const saved = adminServices.uiPreference.readCollapsedSidebarGroups();
    if (saved.length) {
      setCollapsedGroups(saved);
    }
    setIsInitialized(true);
  }, []);

  // Save state to localStorage when it changes
  React.useEffect(() => {
    if (isInitialized) {
      adminServices.uiPreference.writeCollapsedSidebarGroups(collapsedGroups);
    }
  }, [collapsedGroups, isInitialized]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const adminProtectedPaths: string[] = [
    AdminConstants.ROUTES.ROOT,
    AdminConstants.ROUTES.PLUGINS.ROOT,
    AdminConstants.ROUTES.USERS.ROOT,
    AdminConstants.ROUTES.SETTINGS.ROOT,
    AdminConstants.ROUTES.MEDIA.ROOT,
    AdminConstants.ROUTES.USERS.ROLE_LIST,
    AdminConstants.ROUTES.USERS.PERMISSIONS,
    AdminConstants.ROUTES.ACTIVITY,
  ];

  const coreGroupPaths: string[] = [
    AdminConstants.ROUTES.ROOT,
    AdminConstants.ROUTES.USERS.ROOT,
    AdminConstants.ROUTES.MEDIA.ROOT,
  ];

  const managementGroupPaths: string[] = [
    AdminConstants.ROUTES.PLUGINS.ROOT,
    AdminConstants.ROUTES.THEMES.ROOT,
  ];

  // Filter out items the user shouldn't see
  // For now, only 'admin' can see everything. 
  // In the future, this will be more granular.
  const authorizedMenuItems = menuItems.filter(item => {
    // If it's a platform/system route, require admin
    const isAdminRoute = adminProtectedPaths.some(path => item.path === path || item.path?.startsWith(path + '/'));
    
    if (isAdminRoute && !user?.roles?.includes('admin')) {
      return false;
    }

    return true;
  });

  const footerSettingsPath = React.useMemo(
    () => NavUtils.normalizePath(AdminConstants.ROUTES.SETTINGS.ROOT),
    []
  );
  const footerSettingsItem = React.useMemo(
    () => authorizedMenuItems.find((item) => NavUtils.normalizePath(item.path) === footerSettingsPath) || null,
    [authorizedMenuItems, footerSettingsPath]
  );
  const footerSettingsIsGroup = React.useMemo(
    () => Boolean(footerSettingsItem && 'isGroup' in footerSettingsItem && footerSettingsItem.isGroup),
    [footerSettingsItem]
  );
  const groupedMenuItems = React.useMemo(
    () => authorizedMenuItems.filter((item) => NavUtils.normalizePath(item.path) !== footerSettingsPath),
    [authorizedMenuItems, footerSettingsPath]
  );

  // Group menu items by their group property.
  // groupLabels preserves the original casing from the collection definition so
  // that "E-commerce" is not lowercased to "e-commerce" in the sidebar header.
  const groupLabels: Record<string, string> = {};
  const groupedMenu = groupedMenuItems
    .reduce((acc: Record<string, any[]>, item) => {
    const rawGroup = NavUtils.normalizeGroupKey(item.group);
    const originalLabel = String(item.group || '').trim();

    // Manual mapping for core items if they don't have a group
    let groupKey = rawGroup;
    if (coreGroupPaths.includes(item.path)) {
      groupKey = 'core';
    } else if (managementGroupPaths.includes(item.path)) {
      groupKey = 'management';
    } else if (item.path === AdminConstants.ROUTES.ACTIVITY) {
      groupKey = 'system';
    }

    // First item in this group wins the display label (all items in a group
    // should have the same casing). Built-in groups (core/management/settings/system)
    // keep their configured label; plugin/theme groups use the original casing from
    // the collection definition so "E-commerce" is not lowercased to "e-commerce".
    if (!groupLabels[groupKey] && originalLabel) {
      const configured = NavUtils.getMenuGroupMeta(groupKey);
      const isBuiltIn = ['core', 'management', 'settings', 'system'].includes(groupKey);
      groupLabels[groupKey] = isBuiltIn ? configured.label : originalLabel;
    }

      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {});

  const sortedGroups = NavUtils.sortMenuGroups(Object.keys(groupedMenu))
    .filter((groupKey) => !NavUtils.getMenuGroupMeta(groupKey).manual);

  const activePrimaryContextId = React.useMemo(() => {
    const normalizedPath = NavUtils.normalizePath(pathname);
    if (!normalizedPath) {
      return '';
    }

    const entries: Array<{ path: string; pluginSlug: string }> = [];
    for (const item of authorizedMenuItems) {
      const itemPath = NavUtils.normalizePath(item.path);
      if (itemPath) {
        entries.push({ path: itemPath, pluginSlug: String(item.pluginSlug || '').trim().toLowerCase() });
      }

      for (const child of item.children || []) {
        const childPath = NavUtils.normalizePath(child.path);
        if (!childPath) {
          continue;
        }
        entries.push({
          path: childPath,
          pluginSlug: String(child.pluginSlug || item.pluginSlug || '').trim().toLowerCase(),
        });
      }
    }

    const bestPath = NavUtils.resolveBestMatchPath(normalizedPath, entries.map((entry) => entry.path));
    if (!bestPath) {
      return '';
    }

    const match = entries.find((entry) => entry.path === bestPath);
    return String(match?.pluginSlug || '');
  }, [authorizedMenuItems, pathname]);

  const activeTopLevelItem = React.useMemo(() => {
    if (normalizedActivePrimaryPathOverride) {
      return authorizedMenuItems.find((item) => NavUtils.normalizePath(item.path) === normalizedActivePrimaryPathOverride) || null;
    }

    return NavUtils.resolveBestMatchEntry(pathname, authorizedMenuItems);
  }, [authorizedMenuItems, normalizedActivePrimaryPathOverride, pathname]);

  const activeGroupKey = React.useMemo(() => {
    const normalizedGroup = NavUtils.normalizeGroupKey(activeTopLevelItem?.group);
    if (coreGroupPaths.includes(String(activeTopLevelItem?.path || ''))) {
      return 'core';
    }
    if (managementGroupPaths.includes(String(activeTopLevelItem?.path || ''))) {
      return 'management';
    }
    if (String(activeTopLevelItem?.path || '') === AdminConstants.ROUTES.ACTIVITY) {
      return 'system';
    }
    return normalizedGroup;
  }, [activeTopLevelItem, coreGroupPaths, managementGroupPaths]);

  React.useEffect(() => {
    onActiveContextChange?.(activePrimaryContextId);
  }, [activePrimaryContextId, onActiveContextChange]);

  const showMobileSecondaryPanel = Boolean(showInlineSecondary && !isMini && (inlineSecondaryItems || []).length > 0);

  return (
    <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-[72px]' : showMobileSecondaryPanel ? 'w-full max-w-full' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 bg-white border-slate-200 dark:bg-[#020617] dark:border-slate-800 ${showMobileSecondaryPanel ? 'border-r-0' : 'border-r'} flex ${showMobileSecondaryPanel ? 'flex-row lg:flex-col' : 'flex-col'} shadow-2xl lg:shadow-[12px_0_28px_-24px_rgba(15,23,42,0.28)] dark:lg:shadow-[12px_0_28px_-24px_rgba(2,6,23,0.9)] overflow-hidden group/sidebar`} onMouseEnter={onPreviewRegionEnter} onMouseLeave={onPreviewRegionLeave}>
      <div className={`min-w-0 ${showMobileSecondaryPanel ? 'w-[45%] max-w-[18rem] min-w-[15rem] border-r border-slate-200 dark:border-slate-800' : 'w-full flex-1 min-h-0'} flex flex-col bg-white dark:bg-[#020617]`}>
        <div className={`p-5 flex items-center shrink-0 ${isMini ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${isMini ? 'justify-center px-1' : 'gap-3'}`}>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
              <img src={ATLANTIS_MARK_PATH} alt={`${platformName} mark`} className="h-7 w-7 rounded-lg" />
            </div>
            {!isMini && (
              <div className={`flex flex-col`}>
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                  {platformName}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1 leading-none">
                  by {AppEnv.COMPANY_NAME}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Close size={20} />
          </button>
        </div>
        
        <nav className={`flex-1 min-h-0 ${isMini ? 'px-2' : 'px-4'} py-2 overflow-y-auto overscroll-contain scrollbar-hide space-y-1 pb-32`}>
        <div className="pt-2">
           {!isMini && <Slot name="admin.layout.sidebar.top" />}
        </div>

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
                <div className={`px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1.5 ${groupIdx === 0 ? 'mt-4' : 'mt-6'}`}>
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

        <div className="mt-auto pt-6 space-y-1">
          {!isMini && (
            <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400/70 dark:text-slate-500 mb-1.5">
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
        
        <div className="mt-4">
           {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
        </div>

        </nav>
      </div>

      {showMobileSecondaryPanel && (
        <div className="lg:hidden min-w-0 flex-1 flex flex-col bg-slate-50/90 dark:bg-[#0b1220]">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              More In {String(inlineSecondarySourceLabel || inlineSecondaryContext?.label || 'This Section').trim()}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
            <SecondarySidebarPanelBody
              context={inlineSecondaryContext || null}
              items={inlineSecondaryItems || []}
              sourceLabel={String(inlineSecondarySourceLabel || '')}
              pathname={pathname}
              onListKeyDown={() => undefined}
              onItemActivate={onClose}
            />
          </div>
        </div>
      )}

      {/* Mini Toggle Button */}
      <div className={`absolute bottom-0 left-0 right-0 border-t border-slate-100 dark:border-slate-800 hidden lg:block bg-white dark:bg-[#020617] z-50 ${isMini ? 'p-2.5' : 'p-4'}`}>
        <button
          onClick={onMiniToggle}
          className={`flex items-center justify-center rounded-xl transition-all duration-300 hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400 font-bold ${isMini ? 'w-10 h-10 shadow-sm shadow-indigo-500/5' : 'w-full p-2.5 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none bg-slate-50/50 dark:bg-slate-900/40'}`}
        >
          <div className={`transition-transform duration-500 ${isMini ? 'rotate-180' : ''}`}>
             <Left size={18} strokeWidth={2.5} />
          </div>
          {!isMini && <span className="ml-3 text-[11px] font-bold tracking-tight text-slate-500 transition-colors uppercase">Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
