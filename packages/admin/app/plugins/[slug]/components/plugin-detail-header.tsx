"use client";

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import type { PluginDetailHeaderProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailHeader({
  activeTab,
  isSaving,
  isUpdating,
  marketplaceItem,
  onSaveSandbox,
  onUpdate,
  plugin,
  theme,
}: PluginDetailHeaderProps) {
  const hasUpdate = Boolean(marketplaceItem?.version && VersionComparisonService.isGreater(marketplaceItem.version, plugin.manifest.version));

  return (
    <div className="flex items-center gap-6">
      <Link
        href={AdminConstants.ROUTES.PLUGINS.INSTALLED}
        className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${theme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
      >
        <FrameworkIcons.Left size={20} strokeWidth={2.5} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className={`text-3xl font-semibold tracking-tighter truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {plugin.manifest.name}
          </h1>
          <Badge variant={plugin.state === 'active' ? 'success' : 'gray'}>{plugin.state}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{plugin.manifest.slug}</span>
          <span className="text-slate-500 opacity-30">•</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${hasUpdate ? 'text-amber-500' : 'text-slate-400'}`}>
            Version {plugin.manifest.version}
          </span>
          {hasUpdate && (
            <button
              onClick={onUpdate}
              disabled={isUpdating}
              className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
              {isUpdating ? 'Updating...' : 'Update Available'}
            </button>
          )}
        </div>
      </div>
      {activeTab === 'resources' && (
        <Button onClick={onSaveSandbox} isLoading={isSaving} className="px-8 rounded-xl shadow-lg shadow-indigo-600/10">
          Update Policy
        </Button>
      )}
    </div>
  );
}
