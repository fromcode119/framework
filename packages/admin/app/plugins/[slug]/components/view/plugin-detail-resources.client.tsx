import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginDetailResources extends PureReactor {
  /** The EFFECTIVE platform default in force right now, or `null` before it has loaded — never the
   *  shipped constant, which drifts from this the moment an operator sets Settings → Infrastructure
   *  → Plugin Isolation to something else. */
  @prop declare isolationDefaults: { memoryMb: number; timeoutMs: number } | null;
  @prop declare onSandboxSettingsChange: (value: IPluginSandboxSettings) => void;
  @prop declare sandboxSettings: IPluginSandboxSettings;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { isolationDefaults, onSandboxSettingsChange, sandboxSettings, theme } = this;
    // Matches the sibling "Blank uses the platform default" fields on Settings → Infrastructure →
    // Plugin Isolation (page-cards.client.tsx): a floor above zero, so the operator cannot save a
    // value the runtime (`PluginIsolationSettings.forPlugin`, `> 0 ? n : platformDefault`) would
    // silently treat as "no limit set" while the form still shows it as configured.
    const MEMORY_MIN_MB = 64;
    const TIMEOUT_MIN_MS = 1000;
    const memoryPlaceholder = isolationDefaults ? AdminI18n.t('plugins.detail.default', { memoryMb: isolationDefaults.memoryMb }) : AdminI18n.t('plugins.detail.platformDefault');
    const timeoutPlaceholder = isolationDefaults ? AdminI18n.t('plugins.detail.default2', { timeoutMs: isolationDefaults.timeoutMs }) : AdminI18n.t('plugins.detail.platformDefault');
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card title={AdminI18n.t('plugins.detail.sandboxIsolationPolicy')} className={`border-0 p-5 ${theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Zap size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{AdminI18n.t('plugins.detail.memoryHeapLimit')}</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">{AdminI18n.t('plugins.detail.maximumRamAllocatedToThe')}</p>
                </div>
              </div>
              <NumberStepper min={MEMORY_MIN_MB} value={sandboxSettings.memoryLimit} placeholder={memoryPlaceholder} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, memoryLimit: v === '' ? null : (Number.isFinite(parseInt(String(v), 10)) ? parseInt(String(v), 10) : null) })} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl h-fit ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FrameworkIcons.Clock size={20} /></div>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{AdminI18n.t('plugins.detail.executionTimeout')}</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">{AdminI18n.t('plugins.detail.killPluginExecutionIfIt')}</p>
                </div>
              </div>
              <NumberStepper min={TIMEOUT_MIN_MS} value={sandboxSettings.timeout} placeholder={timeoutPlaceholder} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, timeout: v === '' ? null : (Number.isFinite(parseInt(String(v), 10)) ? parseInt(String(v), 10) : null) })} />
            </div>
          </div>
        </Card>
      </div>
    );
  }
}
