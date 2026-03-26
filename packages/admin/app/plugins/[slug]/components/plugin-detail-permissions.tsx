"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@/lib/icons';
import type { PluginDetailPermissionsProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailPermissions({ plugin, theme }: PluginDetailPermissionsProps) {
  return (
    <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
      <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
        Security & Capabilities
      </h3>
      <div className="space-y-6">
        {plugin.manifest.capabilities && plugin.manifest.capabilities.length > 0 ? (
          plugin.manifest.capabilities.map((cap) => {
            const isUnapproved = !plugin.approvedCapabilities?.includes(cap);
            return (
              <div key={cap} className={`flex items-center gap-6 p-6 rounded-[2rem] transition-all duration-300 border ${isUnapproved ? (theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/20')}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isUnapproved ? 'bg-amber-500 shadow-xl shadow-amber-500/20' : 'bg-indigo-600 shadow-xl shadow-indigo-500/25'} text-white`}>
                  {cap.includes('db') || cap.includes('database') ? <FrameworkIcons.Database size={20} /> : cap.includes('api') ? <FrameworkIcons.Globe size={20} /> : cap.includes('hook') ? <FrameworkIcons.Zap size={20} /> : <FrameworkIcons.Shield size={20} />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-semibold tracking-tight ${isUnapproved ? 'text-amber-700 dark:text-amber-400' : 'text-slate-950 dark:text-white'}`}>
                    {cap.split(':').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium italic">
                    {isUnapproved ? 'Warning: This new capability requires your explicit approval.' : `Granted access to the system ${cap.split(':')[0]} layer.`}
                  </p>
                </div>
                <Badge variant={isUnapproved ? 'warning' : 'success'} className={isUnapproved ? 'animate-pulse' : ''}>
                  {isUnapproved ? 'UNAPPROVED' : 'GRANTED'}
                </Badge>
              </div>
            );
          })
        ) : (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
            <FrameworkIcons.Shield className="text-slate-100 dark:text-slate-900 mb-6" size={64} />
            <p className="text-slate-500 font-bold">Standard Isolation</p>
            <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Minimal system permissions</p>
          </div>
        )}
      </div>
    </Card>
  );
}
