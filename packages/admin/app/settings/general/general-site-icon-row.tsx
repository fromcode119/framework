import { SiteIcon, SiteIconSource } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';
import { Explanation } from '@/components/ui/view/explanation.client';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The site's icon — what `/favicon.ico` and `/apple-touch-icon.png` serve. The picker hands back a
 * media id (or a theme file); the setting stores it as text, blank for none.
 *
 * Blank is not "no icon": the site then serves its theme's own favicon, or the platform's mark. Which
 * one is read from the site's `/system/frontend` (`siteIcon.themeFavicon`) and named under the field,
 * with the theme screen it comes from — the empty state says what it resolves to.
 */
export class GeneralSiteIconRow extends AdminComponent {
  static readonly KEY = 'site_icon';

  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;

  @state fallback: { icon: SiteIcon; themeSlug: string } | null = null;

  async componentDidMount(): Promise<void> {
    try {
      const frontend = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND, { noDedupe: true });
      this.fallback = { icon: SiteIcon.from(frontend?.siteIcon), themeSlug: String(frontend?.activeTheme?.slug || '').trim() };
    } catch (error) {
      console.warn('[GeneralSiteIconRow] Could not read which icon the site serves:', error);
    }
  }

  @bound
  protected change(value: unknown): void {
    this.setSettings((prev) => ({ ...prev, [GeneralSiteIconRow.KEY]: value ? String(value) : '' }));
  }

  private get value(): string {
    return String(this.settings[GeneralSiteIconRow.KEY] || '');
  }

  /** What an empty field serves — named only while the field IS empty, and only once it is known. */
  private get emptyStateLine(): ReactNode {
    if (this.value || !this.fallback) return null;
    const choice = this.fallback.icon.themeFavicon;
    if (choice.source !== SiteIconSource.THEME) return <p>{AdminI18n.t('settings.general.siteIconEmptyPlatform')}</p>;
    return (
      <p>
        {AdminI18n.t('settings.general.siteIconEmptyTheme', { file: choice.file, theme: this.fallback.themeSlug })}{' '}
        <AdminLink href={AdminConstants.ROUTES.THEMES.INSTALLED}>{AdminI18n.t('settings.general.siteIconThemesLink')}</AdminLink>
      </p>
    );
  }

  render(): ReactNode {
    const line = this.emptyStateLine;
    return (
      <SettingRow
        theme={this.theme}
        title={AdminI18n.t('settings.general.siteIcon')}
        description={AdminI18n.t('settings.general.siteIconDescription')}
        explanation={line ? <Explanation>{line}</Explanation> : undefined}
      >
        <MediaRelationField value={this.value} onChange={this.change} theme={this.theme} wholeImage compact />
      </SettingRow>
    );
  }
}
