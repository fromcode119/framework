import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';

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
      <Card title="API Firewall">
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX}
          icon={FrameworkIcons.ShieldAlert}
          title="Rate Limit (Max Requests)"
          description="The maximum number of requests a single anonymous IP can make in one window."
          min={0}
          max={1000000}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED}
          icon={FrameworkIcons.ShieldCheck}
          title="Rate Limit (Signed-in Requests)"
          description="The maximum number of requests a signed-in session can make. Counted per IP plus token, so one busy admin session cannot starve another behind the same IP."
          min={0}
          max={1000000}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL}
          icon={FrameworkIcons.Server}
          title="Rate Limit (Internal Service Requests)"
          description="The maximum number of requests an internal service can make. Counted per calling service address, so the storefront renderer, which fetches this API several times per page view from a single container, does not spend the anonymous visitor budget."
          min={0}
          max={1000000}
        />

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Network}
          title="Internal Service Clients"
          description="Addresses or CIDR blocks your own services call this API from, comma separated (for example 172.16.0.0/12). A caller is internal only when both its network hop and its resolved address are listed, never because of a header it sent. Leave empty and nothing is internal: every anonymous caller falls back to the per-IP limit above."
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
          title="Rate Limit Window (milliseconds)"
          description="Every counter above resets after this window elapses. Example: 900000 is 15 minutes. Changing it restarts the counters."
          min={1000}
          max={86400000}
        />
      </Card>
    );
  }
}
