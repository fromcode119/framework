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

    const filtered = stats.filter(s => {
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
    });

    // Default (collapsed) view: surface the most populated collections first and cap the
    // list so the dashboard isn't a wall of every collection's row count. "View All" expands.
    const visible = showAllCollections
      ? filtered
      : [...filtered].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)).slice(0, 12);

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map(s => {
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
            <div key={s.slug} className="p-3 rounded-xl border flex items-center gap-3 transition-colors hover:border-indigo-200 group cursor-pointer bg-white border-slate-200/70 shadow-sm dark:bg-slate-900/40 dark:border-slate-800 dark:shadow-none" onClick={() => onNavigate(adminPath)}>
              <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg transition-colors bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400 [&_svg]:h-4 [&_svg]:w-4">
                <DynamicIcon name={s.icon || 'Database'} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-tight text-slate-400 uppercase truncate">{s.name || colShortSlug}</p>
                <div className="flex items-baseline gap-1.5">
                  <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">{s.count}</h4>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{(s.system || colPluginSlug === AdminConstants.SYSTEM_PLUGIN_SLUG) ? 'Core' : displayPluginSlug}</span>
                </div>
              </div>
              <FrameworkIcons.ArrowRight size={14} className="shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          );
        })}
      </div>
    );
  }
}
