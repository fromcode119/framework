"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { useAuth } from '@/components/AuthContext';
import { Icon } from '@/components/Icon';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const { 
  Dashboard, 
  Plugins, 
  Users, 
  Settings, 
  Text, 
  Media,
  System,
  Package,
  Down,
  Close,
  Zap,
  Activity,
  Refresh
} = FrameworkIcons;

interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  children?: any[];
  isMini?: boolean;
}

const NavItem = ({ icon, label, href, active, onClick, children, isMini }: NavItemProps) => {
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
  // If a child is active, the parent is only "expanded" but not necessarily highlighted as the primary destination.
  const isHighlighted = active && !isChildActive;

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center group relative ${isMini ? 'justify-center w-full' : 'gap-1'}`}>
        <Link 
          href={href} 
          onClick={() => {
            if (hasChildren && !expanded) setExpanded(true);
            onClick?.();
          }}
          className={`flex items-center transition-all duration-300 ${
            isHighlighted 
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
              : isChildActive
                ? (theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-600 font-bold shadow-sm shadow-indigo-200/50')
                : `text-slate-500 ${theme === 'dark' ? 'hover:bg-slate-800/60 hover:text-slate-200' : 'hover:bg-indigo-50/50 hover:text-indigo-600 hover:shadow-indigo-500/5'}`
          } ${isMini ? 'justify-center w-12 h-12 rounded-full' : 'flex-1 justify-between px-3.5 py-2.5 rounded-xl'}`}
        >
          <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-3'}`}>
            <span className={`${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-500' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'} flex items-center justify-center`}>
              {icon}
            </span>
            {!isMini && (
              <span className={`text-[13px] ${isHighlighted || isChildActive ? 'font-bold' : 'font-semibold'}`}>
                {label}
              </span>
            )}
          </div>
        </Link>

        {isMini && (
          <div className={`absolute left-full ml-4 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-2xl border ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {label}
            </div>
            {/* Tooltip Arrow */}
            <div className={`absolute top-1/2 -left-1 -translate-y-1/2 rotate-45 w-2 h-2 border-l border-b ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`} />
          </div>
        )}

        {hasChildren && !isMini && (
          <button 
            onClick={(e) => {
              e.preventDefault();
              setExpanded(!expanded);
            }}
            className={`p-2 rounded-lg transition-colors ${
              isHighlighted || isChildActive
                ? 'text-indigo-500' 
                : theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
            }`}
          >
            <Down size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      
      {hasChildren && expanded && !isMini && (
        <div className="flex flex-col gap-0.5 mt-1 transition-all duration-300">
          {children.map((child) => {
            const isSubActive = pathname === child.path;
            const subIcon = child.icon || 'Circle';
            
            return (
              <Link
                key={child.path}
                href={child.path}
                onClick={onClick}
                className={`flex items-center gap-3 py-2.5 pl-11 pr-4 text-[11px] transition-all relative group/sub rounded-r-xl ${
                  isSubActive
                    ? (theme === 'dark' ? 'text-indigo-400 bg-slate-900/40' : 'text-indigo-600 bg-indigo-50/40 shadow-sm shadow-indigo-100/50')
                    : `text-slate-500 hover:text-indigo-600 hover:bg-slate-50/50 dark:hover:bg-slate-900/20`
                }`}
              >
                 {/* Selection Indicator Pill */}
                 {isSubActive && (
                   <div className="absolute left-[32px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                 )}
                 {!isSubActive && (
                   <div className="absolute left-[33px] top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-200 dark:bg-slate-800 rounded-full group-hover/sub:bg-indigo-300 group-hover/sub:h-4 transition-all opacity-0 group-hover/sub:opacity-100" />
                 )}

                 <div className="flex items-center gap-2.5">
                   <div className={`flex items-center justify-center transition-all duration-300 ml-1 ${
                     isSubActive 
                       ? 'text-indigo-500 scale-110' 
                       : 'text-slate-400 opacity-40 group-hover/sub:opacity-100 group-hover/sub:text-indigo-500'
                   }`}>
                      <Icon name={subIcon} size={13} />
                   </div>
                   <span className={`font-black uppercase tracking-[0.1em] opacity-80 ${isSubActive ? 'opacity-100 text-indigo-500' : 'group-hover/sub:opacity-100'}`}>
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
  const { menuItems } = usePlugins();
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
      '/', '/plugins', '/users', '/settings', '/media', '/content/users', '/users/roles', '/users/permissions', '/activity'
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
    <aside className={`fixed inset-y-0 left-0 z-[200] ${isMini ? 'w-20' : 'w-64'} transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 lg:relative lg:translate-x-0 ${theme === 'dark' ? 'bg-[#020617] border-slate-800' : 'bg-white border-slate-200'} border-r flex flex-col shadow-2xl lg:shadow-none`}>
      <div className={`p-6 flex items-center ${isMini ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          {!isMini && (
            <span className={`font-bold text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Fromcode
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
          return (
            <React.Fragment key={group}>
              {!isMini && (
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
                    children={menuItems.find(m => m.path === '/users' || m.path === '/content/users')?.children}
                    isMini={isMini}
                  />
                  
                  <NavItem icon={<Plugins size={18}/>} label="Plugins" href="/plugins" active={pathname.startsWith('/plugins')} onClick={onClose} isMini={isMini} />
                  
                  <NavItem icon={<Activity size={18}/>} label="Activity" href="/activity" active={pathname.startsWith('/activity')} onClick={onClose} isMini={isMini} />
                  
                  {/* Other Platform items (excluding the ones we just handled manually) */}
                  {items.filter(i => !['/content/users', '/', '/plugins', '/content/media', '/media', '/users', '/activity'].includes(i.path)).map((item, idx) => (
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
          <NavItem icon={<Settings size={18}/>} label="Settings" href="/settings" active={pathname === '/settings'} onClick={onClose} isMini={isMini} />
        </div>
        
        <div className="mt-4">
           {!isMini && <Slot name="admin.layout.sidebar.bottom" />}
        </div>
      </nav>

      {/* Mini Toggle Button */}
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} hidden lg:block`}>
        <button
          onClick={onMiniToggle}
          className={`w-full flex items-center justify-center p-3 rounded-xl transition-all ${
            theme === 'dark' 
              ? 'hover:bg-slate-800 text-slate-400' 
              : 'hover:bg-slate-50 text-slate-500'
          }`}
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
