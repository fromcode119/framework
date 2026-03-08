"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode119/react';
import { useTheme } from '@/components/theme-context';
import { useAuth } from '@/components/auth-context';
import { Icon } from '@/components/icon';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/lib/env';
import { ROUTES } from '@/lib/constants';
import { 
  normalizeNavPath, 
  isPathMatch, 
  resolveBestMatchPath, 
  isPathActive,
  normalizeGroupKey,
  normalizeMenuPath,
  getMenuGroupMeta,
  sortMenuGroups
} from '@/lib/nav-utils';

const { 
  Close = () => null, 
  Zap = () => null,
  Down = () => null,
  Left = () => null,
  // System-level icons still used directly
  Activity = () => null,
  Settings = () => null
} = (FrameworkIcons || {}) as any;

interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  children?: any[];
  isMini?: boolean;
  isGroupHeader?: boolean;
  version?: string;
}

const NavItem = ({ icon, label, href, active, onClick, children, isMini, isGroupHeader, version }: NavItemProps) => {
  const { theme } = useTheme();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const hasChildren = children && children.length > 0;
  
  const childPaths = React.useMemo(
    () => (children || []).map((child) => normalizeNavPath(child.path)).filter(Boolean),
    [children]
  );
  const activeChildPath = React.useMemo(
    () => resolveBestMatchPath(pathname, childPaths as string[]) || '',
    [pathname, childPaths]
  );
  const isChildActive = !!activeChildPath;

  const [expanded, setExpanded] = React.useState(!!(active || isChildActive));

  // Load persistence state
  React.useEffect(() => {
    if (label) {
      const saved = localStorage.getItem(`fc_nav_expanded_${label}`);
      if (saved !== null) {
        setExpanded(saved === 'true');
      }
    }
  }, [label]);

  // Save persistence state
  React.useEffect(() => {
    if (label) {
      localStorage.setItem(`fc_nav_expanded_${label}`, expanded.toString());
    }
  }, [expanded, label]);

  // Auto-expand when a child becomes active
  React.useEffect(() => {
    if (isChildActive) {
      setExpanded(true);
    }
  }, [isChildActive]);

  // The parent is "highlighted" if it is active AND NO CHILD is active.
  const isHighlighted = active && !isChildActive;
  
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
    <div className="flex flex-col gap-1">
      <div className={`flex items-center group relative ${isMini ? 'justify-center w-full' : 'gap-1'}`}>
        <Link 
          href={isGroupHeader ? '#' : href} 
          onClick={handleClick}
          className={`flex items-center transition-all duration-300 ${
            isHighlighted 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
              : isChildActive
                ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-500/10 dark:text-indigo-400'
                : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
          } ${isMini ? 'flex-col justify-center w-14 h-14 rounded-xl gap-1' : 'flex-1 justify-between px-3.5 py-2 rounded-lg'}`}
        >
          <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-3'}`}>
            <span className={`${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-500' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'} flex items-center justify-center`}>
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
            const isSubActive = normalizeNavPath(child.path) === activeChildPath;
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

export default function Sidebar({ isOpen, onClose, isMini, onMiniToggle }: { 
  isOpen?: boolean, 
  onClose?: () => void,
  isMini?: boolean,
  onMiniToggle?: () => void
}) {
  const { menuItems, plugins } = usePlugins();
  const { theme } = useTheme();
  const { user } = useAuth();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  const [collapsedGroups, setCollapsedGroups] = React.useState<string[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Load state from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('fc_sidebar_collapsed_groups');
    if (saved) {
      try {
        setCollapsedGroups(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse sidebar state', e);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save state to localStorage when it changes
  React.useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('fc_sidebar_collapsed_groups', JSON.stringify(collapsedGroups));
    }
  }, [collapsedGroups, isInitialized]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  // Filter out items the user shouldn't see
  // For now, only 'admin' can see everything. 
  // In the future, this will be more granular.
  const authorizedMenuItems = menuItems.filter(item => {
    // If it's a platform/system route, require admin
    const isAdminRoute = [
      '/', '/plugins', '/users', '/settings', '/media', '/users/roles', '/users/permissions', '/activity'
    ].some(path => item.path === path || item.path?.startsWith(path + '/'));
    
    if (isAdminRoute && !user?.roles?.includes('admin')) {
      return false;
    }

    return true;
  });

  // Group menu items by their group property
  const groupedMenu = authorizedMenuItems
    .reduce((acc: Record<string, any[]>, item) => {
    const rawGroup = normalizeGroupKey(item.group);
    
    // Manual mapping for core items if they don't have a group
    let groupKey = rawGroup;
    if (['/', '/users', '/media'].includes(item.path)) {
      groupKey = 'core';
    } else if (['/plugins', '/themes'].includes(item.path)) {
      groupKey = 'management';
    } else if (item.path === '/activity') {
      groupKey = 'system';
    }

      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {});

  const sortedGroups = sortMenuGroups(Object.keys(groupedMenu))
    .filter((groupKey) => !getMenuGroupMeta(groupKey).manual);

  return (
    <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-[72px]' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 bg-white border-slate-200 dark:bg-[#020617] dark:border-slate-800 border-r flex flex-col shadow-2xl lg:shadow-none overflow-hidden group/sidebar`}>
      <div className={`p-5 flex items-center shrink-0 ${isMini ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center ${isMini ? 'justify-center px-1' : 'gap-3'}`}>
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          {!isMini && (
            <div className={`flex flex-col`}>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                {APP_NAME}
              </span>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1 leading-none">
                Admin Panel
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
      
      <nav className={`flex-1 ${isMini ? 'px-2' : 'px-4'} py-2 overflow-y-auto no-scrollbar space-y-1 pb-32`}>
        <div className="pt-2">
           {!isMini && <Slot name="admin.layout.sidebar.top" />}
        </div>
        {sortedGroups.map((group, groupIdx) => {
          const items = groupedMenu[group] || [];
          const displayGroup = getMenuGroupMeta(group).label;
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
                    active={isPathActive(pathname, item.path, items.map((entry) => entry.path))}
                    onClick={onClose}
                    children={item.children}
                    isMini={isMini}
                    isGroupHeader={item.isGroup}
                    version={plugins.find(p => p.slug === item.pluginSlug)?.version}
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
                <NavItem icon={<Icon name="Dashboard" size={18} />} label="Dashboard" href="/" active={pathname === '/'} onClick={onClose} isMini={isMini} />
                <NavItem icon={<Icon name="Package" size={18} />} label="Plugins" href="/plugins" active={pathname === '/plugins'} onClick={onClose} isMini={isMini} />
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
              <NavItem icon={<Activity size={18}/>} label="Activity" href="/activity" active={pathname.startsWith('/activity')} onClick={onClose} isMini={isMini} />
              <NavItem 
                icon={<Settings size={18}/>} 
                label="Settings" 
                href={ROUTES.SETTINGS.GENERAL}
                active={pathname.startsWith('/settings')} 
                onClick={onClose} 
                isMini={isMini} 
                children={[
                  { label: 'General', path: ROUTES.SETTINGS.GENERAL, icon: 'Settings' },
                  { label: 'Framework', path: ROUTES.SETTINGS.FRAMEWORK, icon: 'System' },
                  { label: 'Integrations', path: ROUTES.SETTINGS.INTEGRATIONS, icon: 'Orbit' },
                  { label: 'Localization', path: ROUTES.SETTINGS.LOCALIZATION, icon: 'Globe' },
                  { label: 'Routing', path: ROUTES.SETTINGS.ROUTING, icon: 'Link' },
                  { label: 'Security', path: ROUTES.SETTINGS.SECURITY, icon: 'Shield' },
                  { label: 'Infrastructure', path: ROUTES.SETTINGS.INFRASTRUCTURE, icon: 'Activity' },
                  { label: 'Updates', path: ROUTES.SETTINGS.UPDATES, icon: 'Refresh' },
                ]}
              />
            </>
          )}
        </div>
        
        <div className="mt-4">
           {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
        </div>
      </nav>

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
