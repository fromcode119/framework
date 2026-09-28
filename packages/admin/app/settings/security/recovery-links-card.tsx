import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * How long the one-time links the platform emails stay valid
 * (`AuthControllerTokenSupport` stamps each token with these when it is issued). A link already sent
 * keeps the lifetime it was issued with.
 */
export class RecoveryLinksCard extends PureReactor {
  declare props: Pick<RecoveryLinksCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.recoveryLinks')}>
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES}
          icon={FrameworkIcons.Key}
          title={AdminI18n.t('settings.security.passwordResetLinkLifetimeMinutes')}
          description={AdminI18n.t('settings.security.howLongAPasswordReset')}
          min={5}
          max={1440}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES}
          icon={FrameworkIcons.Mail}
          title={AdminI18n.t('settings.security.emailChangeLinkLifetimeMinutes')}
          description={AdminI18n.t('settings.security.howLongTheConfirmationLink')}
          min={10}
          max={1440}
        />
      </Card>
    );
  }
}
