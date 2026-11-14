import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';

/**
 * One true/false security setting, bound to its `_system_meta` key.
 *
 * `_system_meta` stores text, and the auth policy reads these with
 * `getSettingBoolean()` — i.e. `'true'` is on and everything else is off. The conversion lives here,
 * once, so the page state stays exactly what the server sent and what it will be sent back, and a
 * boolean is never rendered as a text box or a Yes/No dropdown.
 */
export class SettingSwitchRow extends PureReactor {
  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare settingKey: string;
  @prop declare title: ReactNode;
  @prop declare description: ReactNode;
  @prop declare theme: ThemeMode;

  private get isOn(): boolean {
    return String(this.settings[this.settingKey] ?? '').trim().toLowerCase() === 'true';
  }

  @bound
  onChange(checked: boolean): void {
    const key = this.settingKey;
    this.setSettings((prev) => ({ ...prev, [key]: checked ? 'true' : 'false' }));
  }

  render(): ReactNode {
    return (
      <SettingRow theme={this.theme} title={this.title} description={this.description}>
        <Switch checked={this.isOn} onChange={this.onChange} />
      </SettingRow>
    );
  }
}
