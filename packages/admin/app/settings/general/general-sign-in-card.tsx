import { ThemeMode } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Who may sign in and sign up, on the website and in the apps the site serves, and whether an app may
 * start someone without an account. A switch that depends on another is off and disabled while that
 * one is off.
 */
export class GeneralSignInCard extends PureReactor {
  @prop declare platformLocks: PlatformSettingLocks;
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;

  private shown(key: string): boolean {
    return this.platformLocks.shown(key);
  }

  private anyShown(...keys: string[]): boolean {
    return keys.some((key) => this.shown(key));
  }

  @bound
  protected changeFrontendAuthEnabled(val: boolean): void {
    this.setSettings((prev) => ({
      ...prev,
      frontend_auth_enabled: val,
      frontend_registration_enabled: val ? prev.frontend_registration_enabled : false
    }));
  }

  @bound
  protected changeFrontendRegistrationEnabled(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, frontend_registration_enabled: val }));
  }

  @bound
  protected changeAppAuthEnabled(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, app_auth_enabled: val, app_registration_enabled: val ? prev.app_registration_enabled : false, app_anonymous_enabled: val ? prev.app_anonymous_enabled : false }));
  }

  @bound
  protected changeAppRegistrationEnabled(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, app_registration_enabled: val, app_anonymous_enabled: val ? prev.app_anonymous_enabled : false }));
  }

  @bound
  protected changeAppAnonymousEnabled(val: boolean): void {
    this.setSettings((prev) => ({ ...prev, app_anonymous_enabled: val }));
  }

  render(): ReactNode {
    const settings = this.settings;
    const theme = this.theme;
    return (
      <>
        {this.anyShown('frontend_auth_enabled', 'frontend_registration_enabled', 'app_auth_enabled', 'app_registration_enabled', 'app_anonymous_enabled') && (
          <Card title={AdminI18n.t('settings.general.frontendAuth')}>
            {this.shown('frontend_auth_enabled') && (
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Lock}
                title={AdminI18n.t('settings.general.frontendAuthentication')}
                description={AdminI18n.t('settings.general.enablePublicCustomerAuthenticationRoutes')}
              >
                <Switch
                  checked={settings.frontend_auth_enabled}
                  onChange={this.changeFrontendAuthEnabled}
                />
              </SettingRow>
            )}

            {this.shown('frontend_registration_enabled') && (
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Users}
                title={AdminI18n.t('settings.general.frontendRegistration')}
                description={AdminI18n.t('settings.general.allowNewCustomerSelfRegistration')}
              >
                <Switch
                  checked={settings.frontend_registration_enabled}
                  onChange={this.changeFrontendRegistrationEnabled}
                  disabled={!settings.frontend_auth_enabled}
                />
              </SettingRow>
            )}

            {this.shown('app_auth_enabled') && (
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Lock}
                title={AdminI18n.t('settings.general.appAuthentication')}
                description={AdminI18n.t('settings.general.enableAppAuthenticationRoutes')}
              >
                <Switch
                  checked={settings.app_auth_enabled}
                  onChange={this.changeAppAuthEnabled}
                />
              </SettingRow>
            )}

            {this.shown('app_registration_enabled') && (
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Users}
                title={AdminI18n.t('settings.general.appRegistration')}
                description={AdminI18n.t('settings.general.allowNewCustomerAppRegistration')}
              >
                <Switch
                  checked={settings.app_registration_enabled}
                  onChange={this.changeAppRegistrationEnabled}
                  disabled={!settings.app_auth_enabled}
                />
              </SettingRow>
            )}

            {this.shown('app_anonymous_enabled') && (
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Users}
                title={AdminI18n.t('settings.general.appAnonymous')}
                description={AdminI18n.t('settings.general.appAnonymousDescription')}
              >
                <Switch
                  checked={settings.app_anonymous_enabled}
                  onChange={this.changeAppAnonymousEnabled}
                  disabled={!settings.app_auth_enabled || !settings.app_registration_enabled}
                />
              </SettingRow>
            )}
          </Card>
        )}
      </>
    );
  }
}
