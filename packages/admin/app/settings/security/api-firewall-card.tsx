import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingListRow } from '@/app/settings/security/setting-list-row';
import { SettingListSeparator } from '@/app/settings/security/enums/setting-list-separator.enum';
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

        <SettingListRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS}
          separator={SettingListSeparator.COMMA}
          icon={FrameworkIcons.Network}
          title={AdminI18n.t('settings.security.internalServiceClients')}
          description={AdminI18n.t('settings.security.addressesOrCidrBlocksYour')}
          placeholder={AdminI18n.t('settings.security.listAddressPlaceholder')}
        />

        <SettingListRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.TRUSTED_RELAYS}
          separator={SettingListSeparator.COMMA}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.security.trustedRelays')}
          description={AdminI18n.t('settings.security.trustedRelaysHelp')}
          placeholder={AdminI18n.t('settings.security.trustedRelaysNone')}
        />

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

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.PLUGIN_DB_CALLS_PER_MINUTE}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.security.pluginDatabaseCallsPerMinute')}
          description={AdminI18n.t('settings.security.pluginDatabaseCallsPerMinuteHelp')}
          min={0}
          max={100000000}
        />
      </Card>
    );
  }
}
