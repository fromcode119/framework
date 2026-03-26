"use client";

import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import type { PluginDetailSidebarProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailSidebar({
  activeTab,
  onOpenDefinition,
  onOpenDeleteConfirm,
  onTabChange,
  plugin,
  settingsDirty,
  settingsFormRef,
  settingsSaving,
  theme,
}: PluginDetailSidebarProps) {
  return (
    <div className="space-y-8">
      {activeTab === 'settings' && (
        <Card className={`border-0 p-6 animate-in fade-in duration-300 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Save Changes</h3>
          {settingsDirty && (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-amber-500">Unsaved changes</span>
            </div>
          )}
          <button type="submit" form="plugin-settings-form" disabled={settingsSaving || !settingsDirty} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all ${settingsSaving || !settingsDirty ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-95'}`}>
            {settingsSaving ? <><FrameworkIcons.Loader size={14} className="animate-spin" /> Saving...</> : <><FrameworkIcons.Check size={14} /> Save Settings</>}
          </button>
          <div className={`mt-4 pt-4 border-t flex gap-2 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
            <button type="button" onClick={() => settingsFormRef.current?.exportSettings()} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm'}`} title="Export settings as JSON"><FrameworkIcons.Download size={12} /> Export</button>
            <button type="button" onClick={() => settingsFormRef.current?.importSettings()} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm'}`} title="Import settings from JSON"><FrameworkIcons.Upload size={12} /> Import</button>
            <button type="button" onClick={() => settingsFormRef.current?.resetSettings()} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-semibold uppercase tracking-wider transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-rose-400 hover:text-rose-300 hover:border-rose-500/30' : 'bg-slate-50 border-slate-200 text-rose-500 hover:text-rose-700 hover:border-rose-200 shadow-sm'}`} title="Reset settings to defaults"><FrameworkIcons.Refresh size={12} /> Reset</button>
          </div>
        </Card>
      )}
      <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <h3 className={`text-[11px] font-semibold tracking-wider mb-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Manifest Details</h3>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold tracking-wider text-slate-500">Capabilities</span>
            {plugin.manifest.capabilities && plugin.manifest.capabilities.length > 0 ? (
              <button onClick={() => onTabChange('permissions')} className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
                <FrameworkIcons.Shield size={12} />
                {plugin.manifest.capabilities.length} declared
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">None</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold tracking-wider text-slate-500">Author</span>
            <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {typeof plugin.manifest.author === 'object' ? plugin.manifest.author.name : (plugin.manifest.author || 'Official Core')}
            </span>
          </div>
        </div>
        <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} space-y-4`}>
          <button onClick={onOpenDefinition} className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl border font-semibold uppercase tracking-wider text-[11px] transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
            <FrameworkIcons.Code size={16} strokeWidth={2.5} />
            View Definition
          </button>
        </div>
      </Card>
      <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'} ring-1 ring-red-500/20`}>
        <h3 className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-4">System Removal</h3>
        <p className="text-xs font-medium text-red-500/80 leading-relaxed mb-8">
          Uninstalling will permanently remove all configuration, caches and local state associated with this plugin.
        </p>
        <button onClick={onOpenDeleteConfirm} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xl shadow-red-600/20 active:scale-95">
          Uninstall Plugin
        </button>
      </Card>
    </div>
  );
}
