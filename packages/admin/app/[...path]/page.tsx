"use client";

import React, { use } from 'react';
import { usePlugins, Slot } from '@fromcode/react';
import { useTheme } from '@/components/theme-context';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';

const { Info = () => null, Package = () => null } = (FrameworkIcons || {}) as any;

export default function DynamicPluginPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = use(params);
  const pathname = '/' + path.join('/');
  const { menuItems } = usePlugins();
  const { theme } = useTheme();

  // Find the most specific matching menu item
  let activeItem = menuItems.find(item => item.path === pathname);
  
  if (!activeItem) {
    for (const item of menuItems) {
      const child = item.children?.find((c: any) => c.path === pathname);
      if (child) {
        activeItem = { ...child, pluginSlug: child.pluginSlug || item.pluginSlug };
        break;
      }
    }
  }

  if (!activeItem) {
    activeItem = menuItems.find(item => item.path && pathname.startsWith(item.path + '/'));
  }

  const pluginSlug = activeItem?.pluginSlug || path[0];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-8">
        <Slot name={`admin.plugin.${pluginSlug}.page.${path.join('.')}`} fallback={
           <div className="space-y-8">
             <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center gap-3 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
               <Package size={14} />
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
