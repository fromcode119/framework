import { ThemeMode } from '@fromcode119/core/client';
import type { ComponentType, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingRow } from '@/app/settings/security/setting-row';

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
  @prop declare icon: ComponentType<{ size?: number }> | undefined;
  @prop declare title: ReactNode;
  @prop declare description: ReactNode;
  @prop declare min: number;
  @prop declare max: number;
  @prop declare theme: ThemeMode;

  @bound
  onChange(value: number | string): void {
    const key = this.settingKey;
    this.setSettings((prev) => ({ ...prev, [key]: value === '' ? '' : String(value) }));
  }

  render(): ReactNode {
    return (
      <SettingRow theme={this.theme} icon={this.icon} title={this.title} description={this.description}>
        <NumberStepper min={this.min} max={this.max} value={this.settings[this.settingKey] ?? ''} onChange={this.onChange} />
      </SettingRow>
    );
  }
}
