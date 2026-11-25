import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import type { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Settings → Security → Edges: where edges reach the platform (the control channel's address and port),
 * and how long their identities last. The bounds are the ones the server refuses outside of
 * (`EdgeIdentityPolicy.BOUNDS`); the list of edges and "Add edge" are on the Dashboard tab.
 */
export class EdgeIdentityCard extends PureReactor {
  declare props: Pick<EdgeIdentityCard, 'settings' | 'setSettings' | 'theme' | 'scope'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;
  @prop declare scope?: SettingsPageScope;

  @bound
  setAddress(event: ChangeEvent<HTMLInputElement>): void {
    const key = SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS;
    this.setSettings((prev) => ({ ...prev, [key]: event.target.value.trim() }));
  }

  render(): ReactNode {
    const keys = SystemConstants.META_KEY;
    const row = (settingKey: string, name: string, min: number, max: number): ReactNode => (
      <SettingNumberRow theme={this.theme}
          scope={this.scope} settings={this.settings} setSettings={this.setSettings} settingKey={settingKey} min={min} max={max}
        title={AdminI18n.t(`settings.security.${name}`)} description={AdminI18n.t(`settings.security.${name}Help`)} />
    );
    return (
      <Card title={AdminI18n.t('settings.security.edges')}>
        {(!this.scope || this.scope.shows(keys.EDGE_CONTROL_ADDRESS)) && <SettingRow theme={this.theme} title={AdminI18n.t('settings.security.edgeControlAddress')} description={AdminI18n.t('settings.security.edgeControlAddressHelp')}>
          <Input className="w-full max-w-md" value={this.settings[keys.EDGE_CONTROL_ADDRESS] ?? ''} onChange={this.setAddress} placeholder={AdminI18n.t('settings.security.edgeControlAddressPlaceholder')} />
        </SettingRow>}
        {row(keys.EDGE_CONTROL_PORT, 'edgeControlPort', 1, 65_535)}
        {row(keys.EDGE_ENROLLMENT_TOKEN_MINUTES, 'edgeTokenMinutes', 1, 60)}
        {row(keys.EDGE_CERTIFICATE_HOURS, 'edgeCertificateHours', 1, 168)}
        {row(keys.EDGE_CA_INTERMEDIATE_DAYS, 'edgeCaDays', 1, 365)}
      </Card>
    );
  }
}
