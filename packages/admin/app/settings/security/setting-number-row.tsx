import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { NumberStepper } from '@/components/ui/number-stepper';
import type { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SettingRow } from '@/components/ui/view/setting-row.client';

/**
 * One numeric security setting, bound to its `_system_meta` key.
 *
 * `min`/`max` are the bounds the SERVER already clamps this setting to when it reads it (see
 * `packages/api/src/controllers/auth/auth-controller-policy.ts` — `getSettingNumber(key, default,
 * min, max)`). Matching them here is what makes the control honest: every value the operator can
 * enter is the value the policy will use, so nothing is silently rewritten after saving.
 */
export class SettingNumberRow extends PureReactor {
  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare settingKey: string;
  @prop declare title: ReactNode;
  @prop declare description: ReactNode;
  @prop declare min: number;
  @prop declare max: number;
  @prop declare theme: ThemeMode;
  /** The scope the console is in; a setting that does not belong to it is not drawn at all. */
  @prop declare scope?: SettingsPageScope;

  @bound
  onChange(value: number | string): void {
    const key = this.settingKey;
    this.setSettings((prev) => ({ ...prev, [key]: value === '' ? '' : String(value) }));
  }

  render(): ReactNode {
    if (this.scope && !this.scope.shows(this.settingKey)) return null;
    return (
      <SettingRow theme={this.theme} title={this.title} description={this.description}>
        <NumberStepper min={this.min} max={this.max} value={this.settings[this.settingKey] ?? ''} onChange={this.onChange} />
      </SettingRow>
    );
  }
}
