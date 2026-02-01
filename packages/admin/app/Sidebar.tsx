"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { useAuth } from '@/components/AuthContext';
import { Icon } from '@/components/Icon';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/lib/env';

const { 
  Dashboard = () => null, 
  Plugins = () => null, 
  Users = () => null, 
  Settings = () => null, 
  Text = () => null, 
  Media = () => null,
  System = () => null,
  Package = () => null,
  Down = () => null,
  Close = () => null,
  Zap = () => null,
  Activity = () => null,
  Refresh = () => null
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
  
  // A child is active if the pathname matches its path exactly
  const isChildActive = React.useMemo(() => {
    if (!children) return false;
    return children.some(child => pathname === child.path);
  }, [children, pathname]);

  const [expanded, setExpanded] = React.useState(!!(active || isChildActive));

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
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
              : isChildActive
                ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm shadow-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:shadow-none'
                : 'text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-600 hover:shadow-indigo-500/5 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
          } ${isMini ? 'justify-center w-12 h-12 rounded-full' : 'flex-1 justify-between px-3.5 py-2.5 rounded-xl'}`}
        >
          <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-3'}`}>
            <span className={`${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-500' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'} flex items-center justify-center`}>
              {icon}
            </span>
            {!isMini && (
              <div className="flex flex-col">
                <span className={`text-[13px] ${isHighlighted || isChildActive ? 'font-bold' : 'font-semibold'}`}>
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
        </Link>

        {isMini && (
          <div className="absolute left-full ml-4 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-2xl border bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-white">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {label}
            </div>
          </div>
        )}

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
            const isSubActive = pathname === child.path || (child.path !== '/' && pathname.startsWith(child.path + '/'));
            const subIcon = child.icon || 'Circle';
            
            return (
              <Link
                key={child.path}
                href={child.path}
                onClick={onClick}
                className={`flex items-center gap-3 py-2.5 pl-10 pr-4 text-[10px] transition-all relative group/sub rounded-xl mx-2 ${
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
                   <span className={`font-black uppercase tracking-[0.15em] ${isSubActive ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70 group-hover/sub:opacity-100'}`}>
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
  const groupedMenu = authorizedMenuItems.reduce((acc: Record<string, any[]>, item) => {
    const group = item.group;
    if (!group) {
        // Items without a group go into Platform or remain ungrouped
        if (!acc['Platform']) acc['Platform'] = [];
        acc['Platform'].push(item);
    } else {
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
    }
    return acc;
  }, {});

  // Sort groups: Platform first, then alphabetical
  const sortedGroups = Object.keys(groupedMenu).sort((a, b) => {
    if (a === 'Platform') return -1;
    if (b === 'Platform') return 1;
    return a.localeCompare(b);
  });

  return (
    <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-20' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:relative lg:translate-x-0 bg-white border-slate-200 dark:bg-[#020617] dark:border-slate-800 border-r flex flex-col shadow-2xl lg:shadow-none`}>
      <div className={`p-6 flex items-center ${isMini ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          {!isMini && (
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              {APP_NAME}
            </span>
          )}
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Close size={20} />
        </button>
      </div>
      
      <nav className={`flex-1 ${isMini ? 'px-2 overflow-visible' : 'px-4 overflow-y-auto'} space-y-1 pb-8 scrollbar-hide`}>
        <div className="pt-2">
           {!isMini && <Slot name="admin.layout.sidebar.top" />}
        </div>
        {sortedGroups.map((group, groupIdx) => {
          const items = groupedMenu[group];
          // If a group has only one item and that item is a group wrapper (dropdown),
          // we should skip the redundant section header.
          const isRedundantHeader = !isMini && items.length === 1 && items[0].isGroup && items[0].label.toLowerCase() === group.toLowerCase();

          return (
            <React.Fragment key={group}>
              {!isMini && !isRedundantHeader && (
                <p className={`px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${groupIdx === 0 ? 'mt-4' : 'mt-6'}`}>
                  {group}
                </p>
              )}
              {group === 'Platform' ? (
                <>
                  <NavItem icon={<Dashboard size={18}/>} label="Dashboard" href="/" active={pathname === '/'} onClick={onClose} isMini={isMini} />
                  
                  {/* Users and Media */}
                  <NavItem 
                    icon={<Users size={18}/>} 
                    label="Users" 
                    href="/users" 
                    active={pathname.startsWith('/users')} 
                    onClick={onClose} 
                    children={menuItems.find(m => m.path === '/users')?.children}
                    isMini={isMini}
                  />

                  <NavItem icon={<Media size={18}/>} label="Media" href="/media" active={pathname.startsWith('/media')} onClick={onClose} isMini={isMini} />
                  
                  <NavItem icon={<Plugins size={18}/>} label="Plugins" href="/plugins" active={pathname.startsWith('/plugins')} onClick={onClose} isMini={isMini} />
                  
                  <NavItem icon={<Activity size={18}/>} label="Activity" href="/activity" active={pathname.startsWith('/activity')} onClick={onClose} isMini={isMini} />
                  
                  {/* Other Platform items (excluding the ones we just handled manually) */}
                  {items.filter(i => !['/', '/plugins', '/media', '/users', '/activity'].includes(i.path)).map((item, idx) => (
                    <NavItem 
                      key={`${item.pluginSlug}-${idx}`}
                      icon={<Icon name={item.icon || 'Package'} size={18} />}
                      label={item.label}
                      href={item.path}
                      active={item.path ? (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)) : false}
                      onClick={onClose}
                      children={item.children}
                      isMini={isMini}
                    />
                  ))}
                </>
              ) : (
                items.map((item, idx) => (
                  <NavItem 
                    key={`${item.pluginSlug}-${idx}`}
                    icon={<Icon name={item.icon || 'Package'} size={18} />}
                    label={item.label}
                    href={item.path}
                    active={item.path ? (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)) : false}
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

        {/* If Platform group doesn't exist for some reason, ensure basic nav is there */}
        {!groupedMenu['Platform'] && (
          <>
            {!isMini && <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-4">Platform</p>}
            <NavItem icon={<Dashboard size={18}/>} label="Dashboard" href="/" active={pathname === '/'} onClick={onClose} isMini={isMini} />
            <NavItem icon={<Plugins size={18}/>} label="Plugins" href="/plugins" active={pathname === '/plugins'} onClick={onClose} isMini={isMini} />
          </>
        )}

        <div className="mt-auto pt-6">
          {!isMini && <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">System</p>}
          <NavItem icon={<Refresh size={18}/>} label="Updates" href="/settings/updates" active={pathname === '/settings/updates'} onClick={onClose} isMini={isMini} />
          <NavItem icon={<Settings size={18}/>} label="Settings" href="/settings/general" active={pathname.startsWith('/settings')} onClick={onClose} isMini={isMini} />
        </div>
        
        <div className="mt-4">
           {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
        </div>
      </nav>

      {/* Mini Toggle Button */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 hidden lg:block">
        <button
          onClick={onMiniToggle}
          className="w-full flex items-center justify-center p-3 rounded-xl transition-all hover:bg-slate-50 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400"
        >
          <div className={`transition-transform duration-500 ${isMini ? 'rotate-180' : ''}`}>
             <FrameworkIcons.Left size={18} strokeWidth={2.5} />
          </div>
          {!isMini && <span className="ml-3 text-[11px] font-black uppercase tracking-widest">Collapse View</span>}
        </button>
      </div>
    </aside>
  );
}
