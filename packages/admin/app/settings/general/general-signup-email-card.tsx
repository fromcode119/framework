import type { ThemeMode } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { ColorField } from '@/components/ui/view/color-field.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * The email a visitor gets after signing up, to verify their address. Off: the plain framework email.
 * On: the branded email, from the copy below. Each empty field shows, as its placeholder, the text the
 * email sends in its place — the setting's declared default.
 */
export class GeneralSignupEmailCard extends PureReactor {
  static readonly BRANDED_KEY = 'signup_email_branded';

  /** The copy rows, in the order the email shows them. */
  /** The tokens an operator types into these fields; shown as themselves, never filled in here. */
  static get COPY_ROWS(): ReadonlyArray<{ key: string; title: string; description: string }> {
    return [
    { key: 'signup_email_subject', title: AdminI18n.t('settings.general.subject'), description: AdminI18n.t('settings.general.theSubjectLine') },
    { key: 'signup_email_greeting', title: AdminI18n.t('settings.general.greeting'), description: AdminI18n.t('settings.general.aboveTheHeadingAddsFirst', { firstNameSuffix: '{{firstNameSuffix}}' }) },
    { key: 'signup_email_title', title: AdminI18n.t('settings.general.heading'), description: AdminI18n.t('settings.general.theLargeHeading') },
    { key: 'signup_email_message', title: AdminI18n.t('settings.general.message'), description: AdminI18n.t('settings.general.theParagraphUnderTheHeading') },
    { key: 'signup_email_button_label', title: AdminI18n.t('settings.general.button'), description: AdminI18n.t('settings.general.theVerifyButton') },
    { key: 'signup_email_fallback_label', title: AdminI18n.t('settings.general.linkLine'), description: AdminI18n.t('settings.general.aboveThePlainLinkFor') },
    { key: 'signup_email_ignore_message', title: AdminI18n.t('settings.general.closingLine'), description: AdminI18n.t('settings.general.forSomeoneWhoDidNot') },
    { key: 'signup_email_footer_text', title: AdminI18n.t('settings.general.footer'), description: AdminI18n.t('settings.general.theSmallPrintIsThe', { year: '{{year}}' }) },
  ];
  }
  static readonly ACCENT_KEY = 'signup_email_accent_color';

  @prop declare platformLocks: PlatformSettingLocks;
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;

  @bound
  protected changeBranded(checked: boolean): void {
    this.setSettings((prev) => ({ ...prev, [GeneralSignupEmailCard.BRANDED_KEY]: checked }));
  }

  private change(key: string, value: string): void {
    this.setSettings((prev) => ({ ...prev, [key]: value }));
  }

  private renderCopyRow(row: { key: string; title: string; description: string }): ReactNode {
    return (
      <SettingRow key={row.key} theme={this.theme} icon={FrameworkIcons.Edit} title={row.title} description={row.description} stacked>
        <Input
          value={this.settings[row.key] ?? ''}
          onChange={(event: any) => this.change(row.key, event?.target?.value ?? '')}
          placeholder={this.platformLocks.declaredDefault(row.key)}
          disabled={this.platformLocks.locks(row.key)}
          className="w-full"
        />
      </SettingRow>
    );
  }

  render(): ReactNode {
    const locks = this.platformLocks;
    if (!locks.shown(GeneralSignupEmailCard.BRANDED_KEY)) return null;
    const branded = Boolean(this.settings[GeneralSignupEmailCard.BRANDED_KEY]);
    return (
      <Card title={AdminI18n.t('settings.general.signUpEmail')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Mail}
          title={AdminI18n.t('settings.general.brandedSignUpEmail')}
          description={<AdminRichText k="settings.general.brandedSignUpEmailDescription" vars={{ brandName: '{{brandName}}' }} />}
        >
          <Switch checked={branded} onChange={this.changeBranded} disabled={locks.locks(GeneralSignupEmailCard.BRANDED_KEY)} />
        </SettingRow>
        {branded && GeneralSignupEmailCard.COPY_ROWS.map((row) => this.renderCopyRow(row))}
        {branded && (
          <SettingRow theme={this.theme} icon={FrameworkIcons.Palette} title={AdminI18n.t('settings.general.accentColour')} description={AdminI18n.t('settings.general.theVerifyButtonAndLink')}>
            <ColorField
              value={this.settings[GeneralSignupEmailCard.ACCENT_KEY] || locks.declaredDefault(GeneralSignupEmailCard.ACCENT_KEY)}
              onChange={(value: string) => this.change(GeneralSignupEmailCard.ACCENT_KEY, value)}
              disabled={locks.locks(GeneralSignupEmailCard.ACCENT_KEY)}
            />
          </SettingRow>
        )}
      </Card>
    );
  }
}
