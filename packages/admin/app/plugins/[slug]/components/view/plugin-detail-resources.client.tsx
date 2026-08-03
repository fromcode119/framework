import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';

export class PluginDetailResources extends PureReactor {
  @prop declare onSandboxSettingsChange: (value: IPluginSandboxSettings) => void;
  @prop declare sandboxSettings: IPluginSandboxSettings;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { onSandboxSettingsChange, sandboxSettings, theme } = this;
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card title="Sandbox Isolation Policy" className={`border-0 p-5 ${theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Shield size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>Sandbox Isolation</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">Enabled by default. Disable only for fully trusted plugins.</p>
                </div>
              </div>
              <Switch checked={sandboxSettings.enabled} onChange={(value) => onSandboxSettingsChange({ ...sandboxSettings, enabled: value ?? false })} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Zap size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>Memory Heap Limit</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">Maximum RAM allocated to the V8 isolate. (MB)</p>
                </div>
              </div>
              <NumberStepper min={0} value={sandboxSettings.memoryLimit} disabled={!sandboxSettings.enabled} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, memoryLimit: Number.isFinite(parseInt(String(v), 10)) ? parseInt(String(v), 10) : 128 })} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Clock size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>Execution Timeout</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">Kill plugin execution if it takes longer than this. (ms)</p>
                </div>
              </div>
              <NumberStepper min={0} value={sandboxSettings.timeout} disabled={!sandboxSettings.enabled} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, timeout: Number.isFinite(parseInt(String(v), 10)) ? parseInt(String(v), 10) : 1000 })} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-amber-500' : 'bg-amber-50 text-amber-600'}`}><FrameworkIcons.ShieldAlert size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>Allow Native APIs</h3>
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
}
