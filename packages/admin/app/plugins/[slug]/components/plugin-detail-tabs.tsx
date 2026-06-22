"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { PluginDetailTabsProps } from '../plugin-detail-page.interfaces';

export default class PluginDetailTabs extends React.Component<PluginDetailTabsProps> {
  render(): React.ReactNode {
    const { activeTab, onTabChange, theme } = this.props;
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FrameworkIcons.Plugins },
    { id: 'settings', label: 'Configuration', icon: FrameworkIcons.Settings },
    { id: 'permissions', label: 'Security', icon: FrameworkIcons.Shield },
    { id: 'resources', label: 'Resource Limits', icon: FrameworkIcons.Zap },
  ] as const;

  return (
    <div className={`flex gap-2 p-1 rounded-xl w-fit backdrop-blur border transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all rounded-lg ${activeTab === tab.id ? (theme === 'dark' ? 'bg-slate-800 text-indigo-400 shadow-sm shadow-indigo-500/10' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
        >
          <tab.icon size={14} />
          {tab.label}
        </button>
      ))}
    </div>
  );
  }
}
