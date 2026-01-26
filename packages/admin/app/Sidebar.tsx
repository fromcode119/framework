"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
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
  Zap
} = FrameworkIcons;

interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  children?: any[];
}

const NavItem = ({ icon, label, href, active, onClick, children }: NavItemProps) => {
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
      <div className="flex items-center gap-1 group">
        <Link 
          href={href} 
          onClick={onClick}
          className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
            isHighlighted 
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
              : `text-slate-500 ${theme === 'dark' ? 'hover:bg-slate-800/60 hover:text-slate-200' : 'hover:bg-indigo-50/50 hover:text-indigo-600 hover:shadow-indigo-500/5'}`
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={isHighlighted ? 'text-white' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'}>
              {icon}
            </span>
            <span className={`text-[13px] ${isHighlighted || isChildActive ? 'font-bold' : 'font-semibold'}`}>
              {label}
            </span>
          </div>
        </Link>
        {hasChildren && (
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
      
      {hasChildren && expanded && (
        <div className="ml-11 flex flex-col gap-1 py-1 border-l border-slate-200 dark:border-slate-800/50">
          {children.map((child) => (
            <Link
              key={child.path}
              href={child.path}
              onClick={onClick}
              className={`text-left px-3 py-1.5 text-[12px] font-medium transition-colors border-l -ml-px ${
                pathname === child.path
                  ? 'text-indigo-600 border-indigo-600 font-bold'
                  : 'text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const { menuItems } = usePlugins();
  const { theme } = useTheme();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  // Group menu items by their group property
  const groupedMenu = menuItems.reduce((acc: Record<string, any[]>, item) => {
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
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 lg:relative lg:translate-x-0 ${theme === 'dark' ? 'bg-[#020617] border-slate-800' : 'bg-white border-slate-200'} border-r flex flex-col shadow-2xl lg:shadow-none`}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          <span className={`font-bold text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Fromcode
          </span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Close size={20} />
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-8 scrollbar-hide">
        <div className="pt-2">
           <Slot name="admin.layout.sidebar.top" />
        </div>
        {sortedGroups.map((group, groupIdx) => {
          const items = groupedMenu[group];
          return (
            <React.Fragment key={group}>
              <p className={`px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${groupIdx === 0 ? 'mt-4' : 'mt-6'}`}>
                {group}
              </p>
              {group === 'Platform' ? (
                <>
                  <NavItem icon={<Dashboard size={18}/>} label="Dashboard" href="/" active={pathname === '/'} onClick={onClose} />
                  
                  {/* Users and Media */}
                  <NavItem icon={<Users size={18}/>} label="Users" href="/users" active={pathname.startsWith('/users')} onClick={onClose} />
                  <NavItem icon={<Media size={18}/>} label="Media" href="/media" active={pathname.startsWith('/media')} onClick={onClose} />
                  
                  <NavItem icon={<Plugins size={18}/>} label="Plugins" href="/plugins" active={pathname.startsWith('/plugins')} onClick={onClose} />
                  
                  {/* Other Platform items (excluding the ones we just handled manually) */}
                  {items.filter(i => !['/content/users', '/', '/plugins', '/content/media', '/media', '/users'].includes(i.path)).map((item, idx) => (
                    <NavItem 
                      key={`${item.pluginSlug}-${idx}`}
                      icon={<Icon name={item.icon || 'Package'} size={18} />}
                      label={item.label}
                      href={item.path}
                      active={item.path ? (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)) : false}
                      onClick={onClose}
                      children={item.children}
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
                  />
                ))
              )}
            </React.Fragment>
          );
        })}

        {/* If Platform group doesn't exist for some reason, ensure basic nav is there */}
        {!groupedMenu['Platform'] && (
          <>
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-4">Platform</p>
            <NavItem icon={<Dashboard size={18}/>} label="Dashboard" href="/" active={pathname === '/'} onClick={onClose} />
            <NavItem icon={<Plugins size={18}/>} label="Plugins" href="/plugins" active={pathname === '/plugins'} onClick={onClose} />
          </>
        )}

        <div className="mt-auto pt-6">
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">System</p>
          <NavItem icon={<Settings size={18}/>} label="Settings" href="/settings" active={pathname === '/settings'} onClick={onClose} />
        </div>
        
        <div className="mt-4">
           <Slot name="admin.layout.sidebar.bottom" />
        </div>
      </nav>
    </aside>
  );
}
