"use client";

import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { AuthHooks } from '@/components/use-auth';
import { Icon } from '@/components/icon';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppEnv } from '@/lib/env';
import { AdminConstants } from '@/lib/constants';
import { NavUtils } from '@/lib/nav-utils';
import { AdminServices } from '@/lib/admin-services';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';

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
  const extendsSecondary = Boolean((isAnchoredToSecondary || isPreviewingSecondary) && (isHighlighted || isChildActive || isPreviewingSecondary || preserveActiveAnchor));
  
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
    <div className="relative flex flex-col gap-1">
      <div
        className={`flex items-center group relative ${isMini ? 'justify-center w-full' : 'gap-1'}`}
        onMouseEnter={canHoverPreview && !isMini ? () => onHoverPreviewStart?.(href) : undefined}
        onMouseLeave={canHoverPreview && !isMini ? onHoverPreviewEnd : undefined}
      >
        {extendsSecondary && !isMini && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 right-[-2rem] top-0 w-8 ${isHighlighted || preserveActiveAnchor ? 'bg-indigo-600 shadow-[14px_0_28px_-18px_rgba(79,70,229,0.65)]' : isPreviewingSecondary ? 'bg-slate-100 shadow-[14px_0_24px_-20px_rgba(15,23,42,0.14)] dark:bg-slate-800/60 dark:shadow-[14px_0_24px_-20px_rgba(2,6,23,0.55)]' : 'bg-indigo-50 dark:bg-indigo-500/10'}`}
          />
        )}
        <Link 
          href={isGroupHeader ? '#' : href} 
          onClick={handleClick}
          className={`flex items-center transition-all duration-300 ${
            isHighlighted 
              ? 'bg-indigo-600 text-white shadow-[10px_0_28px_rgba(79,70,229,0.28)]' 
              : isPreviewingSecondary
                ? 'bg-slate-100 text-indigo-600 shadow-[10px_0_24px_rgba(15,23,42,0.08)] dark:bg-slate-800/60 dark:text-slate-200'
              : isChildActive
                ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-500/10 dark:text-indigo-400'
                : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
          } ${isMini ? 'flex-col justify-center w-14 h-14 rounded-xl gap-1' : `${extendsSecondary && !hasChildren ? 'w-[calc(100%+2rem)] max-w-none' : 'flex-1'} justify-between px-3.5 py-2 rounded-lg ${extendsSecondary ? 'rounded-r-none relative z-10 mr-[-2rem] pr-5' : ''}`}`}
        >
          <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-3'}`}>
            <span className={`${isHighlighted ? 'text-white' : isPreviewingSecondary ? 'text-indigo-500 dark:text-slate-200' : isChildActive ? 'text-indigo-500' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'} flex items-center justify-center`}>
              {icon}
            </span>
            
            {!isMini && (
              <div className="flex flex-col">
                <span className={`text-[13px] ${isHighlighted || isChildActive ? 'font-bold' : 'font-bold'} tracking-tight whitespace-nowrap`}>
                  {label}
                </span>
                {version && (
                  <span className={`text-[8px] font-mono mt-0.5 opacity-60 ${isHighlighted ? 'text-white' : 'text-slate-400'}`}>
                    v{version}
                  </span>
                )}
              </div>
            )}
          </div>

          {isMini && (
            <span className={`text-[8px] font-bold tracking-tight text-center leading-none px-1 ${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>
              {label.length > 9 ? label.substring(0, 8) + '..' : label}
            </span>
          )}
        </Link>

        {hasChildren && !isMini && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className={`p-2 rounded-lg transition-colors ${
              isHighlighted || isChildActive
                ? 'text-indigo-500' 
                : 'hover:bg-slate-100 text-slate-400 dark:hover:bg-slate-800 dark:text-slate-500'
            }`}
          >
            <Down size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      
      {hasChildren && expanded && !isMini && (
        <div className="flex flex-col gap-0.5 mt-1 relative">
          {/* Vertical track line for visual hierarchy */}
          <div className="absolute left-[21px] top-0 bottom-6 w-px bg-slate-100 dark:bg-slate-800/80" />

          {children.map((child) => {
            const isSubActive = NavUtils.normalizePath(child.path) === activeChildPath;
            const subIcon = child.icon || 'Circle';
            
            return (
              <Link
                key={child.path}
                href={child.path}
                onClick={onClick}
                className={`flex items-center gap-3 py-2 pl-10 pr-4 text-[10px] transition-all relative group/sub rounded-lg mx-2 ${
                  isSubActive
                    ? 'text-indigo-600 bg-indigo-50/50 shadow-sm shadow-indigo-100/20 dark:text-indigo-400 dark:bg-indigo-500/5 dark:shadow-none'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50/30 dark:hover:bg-slate-800/20'
                }`}
              >
                 {/* Horizontal Connector Line */}
                 <div className={`absolute left-[13px] top-1/2 -translate-y-1/2 h-px transition-all duration-300 ${
                   isSubActive ? 'w-4 bg-indigo-500' : 'w-2 bg-slate-200 dark:bg-slate-800 group-hover/sub:bg-indigo-300 group-hover/sub:w-3'
                 }`} />

                 {isSubActive && (
                   <div className="absolute left-[11px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] z-10" />
                 )}

                 <div className="flex items-center gap-2.5">
                   <div className={`flex items-center justify-center transition-all duration-300 ${
                     isSubActive 
                       ? 'text-indigo-500 scale-110' 
                       : 'text-slate-400 opacity-40 group-hover/sub:opacity-100 group-hover/sub:text-indigo-500'
                   }`}>
                      <Icon name={subIcon} size={14} strokeWidth={2.5} />
                   </div>
                   <span className={`font-bold text-[11px] whitespace-nowrap tracking-tight ${isSubActive ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70 group-hover/sub:opacity-100'}`}>
                     {child.label}
                   </span>
                 </div>
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
  const { menuItems, plugins } = ContextHooks.usePlugins();
  const { theme } = ThemeHooks.useTheme();
  const { user } = AuthHooks.useAuth();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const normalizedActivePrimaryPathOverride = React.useMemo(() => NavUtils.normalizePath(activePrimaryPathOverride), [activePrimaryPathOverride]);

  const [collapsedGroups, setCollapsedGroups] = React.useState<string[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

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

  // Group menu items by their group property
  const groupedMenu = groupedMenuItems
    .reduce((acc: Record<string, any[]>, item) => {
    const rawGroup = NavUtils.normalizeGroupKey(item.group);
    
    // Manual mapping for core items if they don't have a group
    let groupKey = rawGroup;
    if (coreGroupPaths.includes(item.path)) {
      groupKey = 'core';
    } else if (managementGroupPaths.includes(item.path)) {
      groupKey = 'management';
    } else if (item.path === AdminConstants.ROUTES.ACTIVITY) {
      groupKey = 'system';
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
      <div className={`min-w-0 ${showMobileSecondaryPanel ? 'w-[45%] max-w-[18rem] min-w-[15rem] border-r border-slate-200 dark:border-slate-800' : 'w-full lg:flex-1 lg:min-h-0'} flex flex-col bg-white dark:bg-[#020617]`}>
        <div className={`p-5 flex items-center shrink-0 ${isMini ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${isMini ? 'justify-center px-1' : 'gap-3'}`}>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
              <img src="/brand/atlantis-mark-indigo.png" alt={`${AppEnv.APP_NAME} mark`} className="h-7 w-7 rounded-lg" />
            </div>
            {!isMini && (
              <div className={`flex flex-col`}>
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                  {AppEnv.APP_NAME}
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
        
        <nav className={`flex-1 min-h-0 ${isMini ? 'px-2' : 'px-4'} py-2 overflow-y-auto scrollbar-hide space-y-1 pb-32`}>
        <div className="pt-2">
           {!isMini && <Slot name="admin.layout.sidebar.top" />}
        </div>

        {sortedGroups.map((group, groupIdx) => {
          const items = groupedMenu[group] || [];
          const displayGroup = NavUtils.getMenuGroupMeta(group).label;
          const isCollapsed = collapsedGroups.includes(group);
          
          // If a group has only one item and that item is a group wrapper (dropdown),
          // we should skip the redundant section header.
          const isRedundantHeader = !isMini && items.length === 1 && items[0].isGroup && items[0].label.toLowerCase() === group;

          return (
            <React.Fragment key={group}>
              {!isMini && !isRedundantHeader && (
                <button 
                  onClick={() => toggleGroup(group)}
                  className={`w-full flex items-center justify-between px-3 text-[11px] font-bold text-slate-400/80 tracking-tight mb-2 group/header ${groupIdx === 0 ? 'mt-4' : 'mt-6'}`}
                >
                  <span className="group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300 transition-colors">
                    {displayGroup}
                  </span>
                  <Down 
                    size={12} 
                    className={`transition-transform duration-200 group-hover/header:text-slate-600 ${isCollapsed ? '-rotate-90' : ''}`} 
                  />
                </button>
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
              <button 
                onClick={() => toggleGroup('core-fallback')}
                className="w-full flex items-center justify-between px-3 text-[11px] font-bold text-slate-400/80 tracking-tight mb-2 mt-4 group/header"
              >
                <span className="group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300 transition-colors">
                  Core
                </span>
                <Down 
                  size={12} 
                  className={`transition-transform duration-200 group-hover/header:text-slate-600 ${collapsedGroups.includes('core-fallback') ? '-rotate-90' : ''}`} 
                />
              </button>
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
            <button 
              onClick={() => toggleGroup('system')}
              className={`w-full flex items-center justify-between px-3 text-[11px] font-bold text-slate-400/80 tracking-tight mb-2 group/header`}
            >
              <span className="group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300 transition-colors">
                System
              </span>
              <Down 
                size={12} 
                className={`transition-transform duration-200 group-hover/header:text-slate-600 ${collapsedGroups.includes('system') ? '-rotate-90' : ''}`} 
              />
            </button>
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
