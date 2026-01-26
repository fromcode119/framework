"use client";

import React, { use } from 'react';
import { usePlugins, Slot } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { usePathname } from 'next/navigation';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';

const { Info, Plugins: Puzzle, Right: ChevronRight, Home } = FrameworkIcons;

export default function DynamicPluginPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = use(params);
  const pathname = '/' + path.join('/');
  const { menuItems, collections } = usePlugins();
  const { theme } = useTheme();

  // Find the most specific matching menu item or collection
  const menuItem = menuItems.find(item => 
    item.path === pathname || 
    item.children?.some(c => c.path === pathname) ||
    (item.path && pathname.startsWith(item.path + '/'))
  );

  const pluginSlug = menuItem?.pluginSlug || path[0];

  const renderBreadcrumbs = () => (
    <nav className="flex items-center gap-2 mb-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
      <Link href="/" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 font-black">
        <Home size={12} />
        PORTAL
      </Link>
      {path.map((segment, i) => (
        <React.Fragment key={segment}>
          <ChevronRight size={10} className="text-slate-300" />
          <Link 
            href={`/${path.slice(0, i + 1).join('/')}`}
            className={`transition-colors font-bold ${i === path.length - 1 ? 'text-indigo-600' : 'hover:text-indigo-600'}`}
          >
            {segment.replace(/-/g, ' ')}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {renderBreadcrumbs()}

      <div className="space-y-8">
        <Slot name={`admin.plugin.${pluginSlug}.page.${path.join('.')}`} fallback={
           <div className="space-y-8">
             <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center gap-3 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
               <Puzzle size={14} />
               Showing default workspace view for <strong>{pluginSlug}</strong>. Register a component for <code>admin.plugin.{pluginSlug}.page.{path.join('.')}</code> to customize this page.
             </div>
             
             <Slot name={`admin.plugin.${pluginSlug}.content`} fallback={
               <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                  <Info className="text-slate-300 dark:text-slate-700 mb-4" size={48} />
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                     Workspace: {path[path.length - 1].replace(/-/g, ' ')}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-sm mt-2">
                     Path <span className="text-indigo-500 font-mono">{pathname}</span> is active, but no specialized UI component was found in <span className="font-bold">{pluginSlug}</span>.
                  </p>
                  <Link href="/plugins" className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20">
                     Back to Marketplace
                  </Link>
               </div>
             }/>
           </div>
        }/>
      </div>
    </div>
  );
}
