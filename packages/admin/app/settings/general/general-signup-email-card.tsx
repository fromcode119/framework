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

/**
 * The email a visitor gets after signing up, to verify their address. Off: the plain framework email.
 * On: the branded email, from the copy below. Each empty field shows, as its placeholder, the text the
 * email sends in its place — the setting's declared default.
 */
export class GeneralSignupEmailCard extends PureReactor {
  static readonly BRANDED_KEY = 'signup_email_branded';

  /** The copy rows, in the order the email shows them. */
  static readonly COPY_ROWS: ReadonlyArray<{ key: string; title: string; description: string }> = [
    { key: 'signup_email_subject', title: 'Subject', description: 'The subject line.' },
    { key: 'signup_email_greeting', title: 'Greeting', description: 'Above the heading. {{firstNameSuffix}} adds ", <first name>" when the visitor gave one.' },
    { key: 'signup_email_title', title: 'Heading', description: 'The large heading.' },
    { key: 'signup_email_message', title: 'Message', description: 'The paragraph under the heading.' },
    { key: 'signup_email_button_label', title: 'Button', description: 'The verify button.' },
    { key: 'signup_email_fallback_label', title: 'Link line', description: 'Above the plain link, for when the button does not work.' },
    { key: 'signup_email_ignore_message', title: 'Closing line', description: 'For someone who did not sign up.' },
    { key: 'signup_email_footer_text', title: 'Footer', description: 'The small print. {{year}} is the current year.' },
  ];
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
      <Card title="Sign-up email">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Mail}
          title="Branded sign-up email"
          description={<>The email a visitor gets to verify their address after signing up. Off: the plain framework email. On: this site&rsquo;s own copy below, signed with the Platform Name. <code>{'{{brandName}}'}</code> in any line is replaced with it.</>}
        >
          <Switch checked={branded} onChange={this.changeBranded} disabled={locks.locks(GeneralSignupEmailCard.BRANDED_KEY)} />
        </SettingRow>
        {branded && GeneralSignupEmailCard.COPY_ROWS.map((row) => this.renderCopyRow(row))}
        {branded && (
          <SettingRow theme={this.theme} icon={FrameworkIcons.Palette} title="Accent colour" description="The verify button and link.">
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
