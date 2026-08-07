import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';

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
      <Card title="Recovery Links">
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES}
          icon={FrameworkIcons.Key}
          title="Password Reset Link Lifetime (minutes)"
          description="How long a password-reset link works before the user has to request a new one."
          min={5}
          max={1440}
        />

        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES}
          icon={FrameworkIcons.Mail}
          title="Email Change Link Lifetime (minutes)"
          description="How long the confirmation link sent to a new email address stays valid."
          min={10}
          max={1440}
        />
      </Card>
    );
  }
}
