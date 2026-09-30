import type { ThemeMode } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The site's email logo — the image at the top of every email it sends, the framework's and the
 * plugins'. The picker hands back a media id; the setting stores it as text, blank for none.
 */
export class GeneralEmailLogoRow extends PureReactor {
  static readonly KEY = 'email_logo';

  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;

  @bound
  protected change(value: unknown): void {
    this.setSettings((prev) => ({ ...prev, [GeneralEmailLogoRow.KEY]: value ? String(value) : '' }));
  }

  render(): ReactNode {
    const value = this.settings[GeneralEmailLogoRow.KEY] || '';
    return (
      <SettingRow
        theme={this.theme}
        icon={FrameworkIcons.Mail}
        title={AdminI18n.t('settings.general.emailLogo')}
        description={AdminI18n.t('settings.general.emailLogoDescription')}
        stacked
      >
        {/* A logo, not a banner: the picker's preview fills its container, so the row sets the size. The
            field's own remove control clears it (the setting stores blank for none). */}
        <div className="max-w-xs space-y-2">
          <MediaRelationField value={value} onChange={this.change} theme={this.theme} wholeImage />
        </div>
      </SettingRow>
    );
  }
}
