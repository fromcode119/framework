import React from 'react';
import { CoreServices } from '@fromcode119/core/client';
import { Icon as DynamicIcon } from '@/components/icon';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import type { DashboardCollectionsGridProps } from './dashboard-sections.interfaces';

export class DashboardCollectionsGrid extends React.Component<DashboardCollectionsGridProps> {
  render(): React.ReactNode {
    const { stats, showAllCollections, onNavigate } = this.props;
    const collectionIdentity = CoreServices.getInstance().collectionIdentity;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.filter(s => {
          if (s.hidden) return false;

          // For core (system===true): users and media are always core
          const isCore = s.system || s.slug === 'users' || s.slug === 'media';
          if (isCore) return true;

          // If show all is toggled, show everything not hidden
          if (showAllCollections) return true;

          // Default view filter logic:
          // 1. Hide internal-looking slugs
          // 2. Hide low count entities that aren't core
          if (collectionIdentity.isInternalCollectionIdentifier(String(s.slug || ''))) return false;

          // Hide empty non-core entities by default
          if (s.count === 0) return false;

          return true;
        }).map(s => {
          const colShortSlug = (s.shortSlug || s.slug).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          const colPluginSlug = s.pluginSlug || AdminConstants.SYSTEM_PLUGIN_SLUG;

          // Content Routing: Platform core entities use root-level paths
          // whilst plugins use /plugin/slug paths.
          let adminPath = `/${colPluginSlug}/${colShortSlug}`;
          const displayPluginSlug = colPluginSlug.charAt(0).toUpperCase() + colPluginSlug.slice(1);

          if (colPluginSlug === AdminConstants.SYSTEM_PLUGIN_SLUG) {
              if (colShortSlug === 'users') adminPath = AdminConstants.ROUTES.USERS.ROOT;
              if (colShortSlug === 'media') adminPath = AdminConstants.ROUTES.MEDIA.ROOT;
              if (colShortSlug === 'activity') adminPath = AdminConstants.ROUTES.ACTIVITY;
          }

          return (
            <div key={s.slug} className="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 group cursor-pointer bg-white border-slate-100 shadow-lg shadow-slate-200/50 dark:bg-slate-900/40 dark:border-slate-800 dark:shadow-none animate-in fade-in duration-300" onClick={() => onNavigate(adminPath)}>
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl transition-all duration-300 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:group-hover:bg-indigo-500/20">
                  <DynamicIcon name={s.icon || 'Database'} size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                     <p className="text-xs font-bold tracking-tight text-slate-400 uppercase">{s.name || colShortSlug}</p>
                     <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-tight uppercase ${
                         (s.system || colPluginSlug === AdminConstants.SYSTEM_PLUGIN_SLUG)
                         ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400'
                         : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                     }`}>
                       {(s.system || colPluginSlug === AdminConstants.SYSTEM_PLUGIN_SLUG) ? 'Core' : displayPluginSlug}
                     </span>
                  </div>
                  <h4 className="text-2xl font-bold tracking-tight mt-0.5 text-slate-900 dark:text-white">{s.count}</h4>
                </div>
              </div>
              <div className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                <FrameworkIcons.ArrowRight size={18} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
