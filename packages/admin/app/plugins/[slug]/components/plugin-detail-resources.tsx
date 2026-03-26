"use client";

import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import type { PluginDetailResourcesProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailResources({ onSandboxSettingsChange, sandboxSettings, theme }: PluginDetailResourcesProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card title="Sandbox Isolation Policy" className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="space-y-10 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex gap-4">
              <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Shield size={20} /></div>
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Sandbox Isolation</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Enabled by default. Disable only for fully trusted plugins.</p>
              </div>
            </div>
            <Switch checked={sandboxSettings.enabled} onChange={(value) => onSandboxSettingsChange({ ...sandboxSettings, enabled: value ?? false })} />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Zap size={20} /></div>
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Memory Heap Limit</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Maximum RAM allocated to the V8 isolate. (MB)</p>
              </div>
            </div>
            <input type="number" value={sandboxSettings.memoryLimit} disabled={!sandboxSettings.enabled} onChange={(event) => onSandboxSettingsChange({ ...sandboxSettings, memoryLimit: Number.isFinite(parseInt(event.target.value, 10)) ? parseInt(event.target.value, 10) : 128 })} className={`w-full md:w-32 px-4 py-2 rounded-xl text-center font-bold ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`} />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Clock size={20} /></div>
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Execution Timeout</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Kill plugin execution if it takes longer than this. (ms)</p>
              </div>
            </div>
            <input type="number" value={sandboxSettings.timeout} disabled={!sandboxSettings.enabled} onChange={(event) => onSandboxSettingsChange({ ...sandboxSettings, timeout: Number.isFinite(parseInt(event.target.value, 10)) ? parseInt(event.target.value, 10) : 1000 })} className={`w-full md:w-32 px-4 py-2 rounded-xl text-center font-bold ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`} />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex gap-4">
              <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-amber-500' : 'bg-amber-50 text-amber-600'}`}><FrameworkIcons.ShieldAlert size={20} /></div>
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Allow Native APIs</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm italic">Advanced mode. Keep disabled unless this plugin explicitly requires native host capabilities.</p>
              </div>
            </div>
            <Switch disabled={!sandboxSettings.enabled} checked={sandboxSettings.allowNative} onChange={(value) => onSandboxSettingsChange({ ...sandboxSettings, allowNative: value ?? false })} />
          </div>
        </div>
      </Card>
    </div>
  );
}
