import { ThemeMode, ThemeState } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The theme page's header (the shared compact one): which theme, its state and version — and its actions: open the
 * site it styles. The Settings tab's edits are saved by the page's save bar.
 */
export class ThemeSettingsHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsHeader, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  private openSite(dark: boolean): ReactNode {
    const url = this.model.livePreviewUrl;
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 fc-size-sm font-medium transition-colors fc-tone-line fc-tone-text fc-tone-hover`}>
        <FrameworkIcons.External size={14} />
        {AdminI18n.t('themes.openSite')}
      </a>
    );
  }

  render(): ReactNode {
    const { themeDetail, adminTheme } = this.model;
    const dark = adminTheme === ThemeMode.DARK;
    const active = themeDetail.state === ThemeState.ACTIVE;
    // Words, never the member: `themeDetail.state` is a `ThemeState` Enum, and an Enum handed to React as a
    // child is an object — it threw "Minified React error #31" and blanked the page.
    const subtitle = (
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <Badge variant={active ? 'success' : 'gray'}>{AdminI18n.t(active ? 'themes.active' : 'themes.inactive')}</Badge>
        <span>v{themeDetail.version}</span>
        {themeDetail.author ? <><span>·</span><span>{themeDetail.author}</span></> : null}
        {/* The vendor: an install refuses a same-slug theme from another one, so it is shown. */}
        <span>·</span>
        <span title={AdminI18n.t('themes.vendorHelp')}>{String(themeDetail.namespace || '').trim() || AdminI18n.t('themes.noVendorDeclared')}</span>
      </span>
    );
    const actions = this.openSite(dark);
    // The same header every settings page has; the back arrow returns to the installed list.
    return <CompactPageHeader backHref={AdminConstants.ROUTES.THEMES.INSTALLED} icon={<FrameworkIcons.Palette />} title={themeDetail.name} subtitle={subtitle} actions={actions} />;
  }
}
