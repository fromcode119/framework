"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { PluginDetailPermissionsProps } from '../plugin-detail-page.interfaces';

export default class PluginDetailPermissions extends React.Component<PluginDetailPermissionsProps> {
  render(): React.ReactNode {
    const { plugin, theme } = this.props;
  return (
    <Card className={`border-0 p-5 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
      <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
        Security & Capabilities
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {plugin.manifest.capabilities && plugin.manifest.capabilities.length > 0 ? (
          plugin.manifest.capabilities.map((cap) => {
            const isUnapproved = !plugin.approvedCapabilities?.includes(cap);
            return (
              <div key={cap} className={`flex items-center gap-3 p-3 rounded-xl transition-colors border ${isUnapproved ? (theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-slate-100 hover:border-indigo-500/20')}`}>
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${isUnapproved ? 'bg-amber-500' : 'bg-indigo-600'} text-white [&_svg]:h-4 [&_svg]:w-4`}>
                  {cap.includes('db') || cap.includes('database') ? <FrameworkIcons.Database size={16} /> : cap.includes('api') ? <FrameworkIcons.Globe size={16} /> : cap.includes('hook') ? <FrameworkIcons.Zap size={16} /> : <FrameworkIcons.Shield size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold tracking-tight truncate ${isUnapproved ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {cap.split(':').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {isUnapproved ? 'Requires your approval' : `System ${cap.split(':')[0]} access`}
                  </p>
                </div>
                <Badge variant={isUnapproved ? 'warning' : 'success'} className={`shrink-0 ${isUnapproved ? 'animate-pulse' : ''}`}>
                  {isUnapproved ? 'UNAPPROVED' : 'GRANTED'}
                </Badge>
              </div>
            );
          })
        ) : (
          <div className="sm:col-span-2 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
            <FrameworkIcons.Shield className="text-slate-200 dark:text-slate-800 mb-3" size={40} />
            <p className="text-slate-500 font-semibold text-sm">Standard Isolation</p>
            <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">Minimal system permissions</p>
          </div>
        )}
      </div>
    </Card>
  );
  }
}
