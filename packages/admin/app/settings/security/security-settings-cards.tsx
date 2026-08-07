import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { AccountDefenseCard } from '@/app/settings/security/account-defense-card';
import { PasswordPolicyCard } from '@/app/settings/security/password-policy-card';
import { LoginProtectionCard } from '@/app/settings/security/login-protection-card';
import { RecoveryLinksCard } from '@/app/settings/security/recovery-links-card';
import { ApiFirewallCard } from '@/app/settings/security/api-firewall-card';

/**
 * The Security tab's form: every card reads and writes the same `settings` map, keyed by the
 * `_system_meta` key the API actually enforces, so what is on screen is what the platform runs.
 */
export class SecuritySettingsCards extends PureReactor {
  declare props: Pick<SecuritySettingsCards, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const settings = this.settings;
    const setSettings = this.setSettings;
    const theme = this.theme;
    return (
      <>
        <AccountDefenseCard settings={settings} setSettings={setSettings} theme={theme} />
        <PasswordPolicyCard settings={settings} setSettings={setSettings} theme={theme} />
        <LoginProtectionCard settings={settings} setSettings={setSettings} theme={theme} />
        <RecoveryLinksCard settings={settings} setSettings={setSettings} theme={theme} />
        <ApiFirewallCard settings={settings} setSettings={setSettings} theme={theme} />
      </>
    );
  }
}
