import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { NumberStepper } from '@/components/ui/number-stepper';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The plugin's resource policy: two limits on settings rows, saved through the page's one save bar (drawn by the view). */
export class PluginDetailResources extends PureReactor {
  /** The EFFECTIVE platform default in force right now, or `null` before it has loaded — never the
   *  shipped constant, which drifts from this the moment an operator sets Settings → Infrastructure
   *  → Plugin Isolation to something else. */
  @prop declare isolationDefaults: { memoryMb: number; timeoutMs: number } | null;
  @prop declare onSandboxSettingsChange: (value: IPluginSandboxSettings) => void;
  /** Writes the policy; false when the write was refused, so the values stay unsaved. */
  @prop declare onSave: () => Promise<boolean>;
  @prop declare sandboxSettings: IPluginSandboxSettings;
  @prop declare theme: ThemeMode;

  private pending: PendingSave | null = null;

  componentDidMount(): void {
    this.pending = new PendingSave(
      () => this.sandboxSettings,
      async () => { if (!(await this.onSave())) this.pending?.failed(); },
      (values: IPluginSandboxSettings) => this.onSandboxSettingsChange(values),
    );
    // The page is drawn only once the plugin has loaded, so what is shown now is what is stored.
    this.pending.mark();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  private static whole(value: unknown): number | null {
    if (value === '') return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

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
      <Card title={AdminI18n.t('plugins.detail.sandboxIsolationPolicy')}>
          <SettingRow theme={theme} title={AdminI18n.t('plugins.detail.memoryHeapLimit')} description={AdminI18n.t('plugins.detail.maximumRamAllocatedToThe')} width={SettingRowWidth.NARROW}>
            <NumberStepper min={MEMORY_MIN_MB} value={sandboxSettings.memoryLimit} placeholder={memoryPlaceholder} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, memoryLimit: PluginDetailResources.whole(v) })} />
          </SettingRow>
          <SettingRow theme={theme} title={AdminI18n.t('plugins.detail.executionTimeout')} description={AdminI18n.t('plugins.detail.killPluginExecutionIfIt')} width={SettingRowWidth.NARROW}>
            <NumberStepper min={TIMEOUT_MIN_MS} value={sandboxSettings.timeout} placeholder={timeoutPlaceholder} onChange={(v) => onSandboxSettingsChange({ ...sandboxSettings, timeout: PluginDetailResources.whole(v) })} />
          </SettingRow>
      </Card>
    );
  }
}
