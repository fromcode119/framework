"use client";

import { FrameworkIcons } from '@/lib/icons';
import type { PluginDetailTabsProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailTabs({ activeTab, onTabChange, theme }: PluginDetailTabsProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FrameworkIcons.Plugins },
    { id: 'settings', label: 'Configuration', icon: FrameworkIcons.Settings },
    { id: 'permissions', label: 'Security', icon: FrameworkIcons.Shield },
    { id: 'resources', label: 'Resource Limits', icon: FrameworkIcons.Zap },
  ] as const;

  return (
    <div className={`flex gap-2 p-1.5 rounded-2xl w-fit backdrop-blur-xl border transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all rounded-xl ${activeTab === tab.id ? (theme === 'dark' ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50') : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
        >
          <tab.icon size={14} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
