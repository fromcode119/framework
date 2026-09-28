import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The request limiter's buckets and budgets, as the API resolves them
 * (`RateLimitBucketUtils` + `RateLimitSettingsUtils`). Every value here is read on each request, so a
 * change to a budget or to the internal-client list takes effect without a restart; changing the
 * window rebuilds the limiter once and restarts its counters.
 */
export class ApiFirewallCard extends PureReactor {
  declare props: Pick<ApiFirewallCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  @bound
  setInternalClients(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    this.setSettings((prev) => ({ ...prev, [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS]: value }));
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.apiFirewall')}>
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX}
          icon={FrameworkIcons.ShieldAlert}
          title={AdminI18n.t('settings.security.rateLimitMaxRequests')}
          description={AdminI18n.t('settings.security.theMaximumNumberOfRequests')}
          min={0}
          max={1000000}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED}
          icon={FrameworkIcons.ShieldCheck}
          title={AdminI18n.t('settings.security.rateLimitSignedInRequests')}
          description={AdminI18n.t('settings.security.theMaximumNumberOfRequests2')}
          min={0}
          max={1000000}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL}
          icon={FrameworkIcons.Server}
          title={AdminI18n.t('settings.security.rateLimitInternalServiceRequests')}
          description={AdminI18n.t('settings.security.theMaximumNumberOfRequests3')}
          min={0}
          max={1000000}
        />

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Network}
          title={AdminI18n.t('settings.security.internalServiceClients')}
          description={AdminI18n.t('settings.security.addressesOrCidrBlocksYour')}
        >
          <Input
            className="w-80"
            value={this.settings[SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS] ?? ''}
            onChange={this.setInternalClients}
            placeholder="127.0.0.0/8, ::1, 10.0.0.0/8"
          />
        </SettingRow>

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_WINDOW}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.security.rateLimitWindowMilliseconds')}
          description={AdminI18n.t('settings.security.everyCounterAboveResetsAfter')}
          min={1000}
          max={86400000}
        />
      </Card>
    );
  }
}
