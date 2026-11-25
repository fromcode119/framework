import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import type { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SystemConstants } from '@fromcode119/core/client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AccountDefenseCard } from '@/app/settings/security/account-defense-card';
import { PasswordPolicyCard } from '@/app/settings/security/password-policy-card';
import { LoginProtectionCard } from '@/app/settings/security/login-protection-card';
import { RecoveryLinksCard } from '@/app/settings/security/recovery-links-card';
import { ApiFirewallCard } from '@/app/settings/security/api-firewall-card';
import { EdgeProtectionCard } from '@/app/settings/security/edge-protection-card';
import { EdgeIdentityCard } from '@/app/settings/security/edge-identity-card';
import { AuditTrailCard } from '@/app/settings/security/audit-trail-card';
import { ContactProtectionCard } from '@/app/settings/security/contact-protection-card';

/**
 * The Security tab's form: every card reads and writes the same `settings` map, keyed by the
 * `_system_meta` key the API actually enforces, so what is on screen is what the platform runs.
 */
export class SecuritySettingsCards extends PureReactor {
  declare props: Pick<SecuritySettingsCards, 'settings' | 'setSettings' | 'theme' | 'scope'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;
  /** Which of these settings belong to the scope the console is in; the rest are not drawn. */
  @prop declare scope?: SettingsPageScope;

  /** Does any of this card's settings belong to the scope? A card with none is not drawn, not drawn empty. */
  private anyShown(...keys: string[]): boolean {
    return !this.scope || keys.some((key) => this.scope!.shows(key));
  }

  render(): ReactNode {
    const settings = this.settings;
    const setSettings = this.setSettings;
    const theme = this.theme;
    const scope = this.scope;
    return (
      <>
        <AccountDefenseCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        <PasswordPolicyCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        <LoginProtectionCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        <RecoveryLinksCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        {this.anyShown(SystemConstants.META_KEY.RATE_LIMIT_MAX, SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED, SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL, SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, SystemConstants.META_KEY.TRUSTED_RELAYS, SystemConstants.META_KEY.RATE_LIMIT_WINDOW, SystemConstants.META_KEY.PLUGIN_DB_CALLS_PER_MINUTE) && <ApiFirewallCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />}
        <EdgeProtectionCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        {this.anyShown(SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS, SystemConstants.META_KEY.EDGE_CONTROL_PORT, SystemConstants.META_KEY.EDGE_ENROLLMENT_TOKEN_MINUTES, SystemConstants.META_KEY.EDGE_CERTIFICATE_HOURS, SystemConstants.META_KEY.EDGE_CA_INTERMEDIATE_DAYS) && <EdgeIdentityCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />}
        <AuditTrailCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
        <ContactProtectionCard settings={settings} setSettings={setSettings} theme={theme} scope={scope} />
      </>
    );
  }
}
