import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the gateway does in front of the sites (`GatewayChallenge`). "Under attack" sends every visitor
 * through a browser check the gateway serves itself, so it works whatever state the site is in; the
 * exempt paths keep apps and payment webhooks working. Saving pushes the change to the gateway.
 */
export class EdgeProtectionCard extends PureReactor {
  declare props: Pick<EdgeProtectionCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  @bound
  setTitle(event: ChangeEvent<HTMLInputElement>): void {
    this.set(SystemConstants.META_KEY.EDGE_CHALLENGE_TITLE, event.target.value);
  }

  @bound
  setMessage(event: ChangeEvent<HTMLTextAreaElement>): void {
    this.set(SystemConstants.META_KEY.EDGE_CHALLENGE_MESSAGE, event.target.value);
  }

  @bound
  setExemptPaths(event: ChangeEvent<HTMLTextAreaElement>): void {
    this.set(SystemConstants.META_KEY.EDGE_CHALLENGE_EXEMPT_PATHS, event.target.value);
  }

  private set(key: string, value: string): void {
    this.setSettings((prev) => ({ ...prev, [key]: value }));
  }

  render(): ReactNode {
    const keys = SystemConstants.META_KEY;
    return (
      <Card title={AdminI18n.t('settings.security.edgeProtection')}>
        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={keys.EDGE_UNDER_ATTACK}
          icon={FrameworkIcons.ShieldAlert}
          title={AdminI18n.t('settings.security.underAttackMode')}
          description={AdminI18n.t('settings.security.underAttackModeHelp')}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={keys.EDGE_RATE_LIMIT_PER_MINUTE}
          icon={FrameworkIcons.Activity}
          title={AdminI18n.t('settings.security.visitorRequestsPerMinute')}
          description={AdminI18n.t('settings.security.visitorRequestsPerMinuteHelp')}
          min={0}
          max={1000000}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={keys.EDGE_CHALLENGE_CLEARANCE_MINUTES}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.security.browserCheckValidMinutes')}
          description={AdminI18n.t('settings.security.browserCheckValidMinutesHelp')}
          min={5}
          max={43200}
        />

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.security.browserCheckExemptPaths')}
          description={AdminI18n.t('settings.security.browserCheckExemptPathsHelp')}
        >
          <TextArea className="w-80" size={FieldSize.MD} value={this.settings[keys.EDGE_CHALLENGE_EXEMPT_PATHS] ?? ''} onChange={this.setExemptPaths} />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Shield}
          title={AdminI18n.t('settings.security.browserCheckPageTitle')}
          description={AdminI18n.t('settings.security.browserCheckPageTitleHelp')}
        >
          <Input className="w-80" value={this.settings[keys.EDGE_CHALLENGE_TITLE] ?? ''} onChange={this.setTitle} />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Shield}
          title={AdminI18n.t('settings.security.browserCheckPageMessage')}
          description={AdminI18n.t('settings.security.browserCheckPageMessageHelp')}
        >
          <TextArea className="w-80" size={FieldSize.MD} value={this.settings[keys.EDGE_CHALLENGE_MESSAGE] ?? ''} onChange={this.setMessage} />
        </SettingRow>
      </Card>
    );
  }
}
