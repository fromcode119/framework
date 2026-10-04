import { ThemeMode, ThemeState } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { DetailBox } from '@/components/view/detail-box.client';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { ThemeOverviewColours } from '@/app/themes/[slug]/components/view/overview/theme-overview-colours.client';
import { ThemeOverviewIntegrations } from '@/app/themes/[slug]/components/view/overview/theme-overview-integrations.client';
import { ThemeOverviewLayouts } from '@/app/themes/[slug]/components/view/overview/theme-overview-layouts.client';
import { DetailSplit } from '@/components/view/detail-split.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The Overview tab — everything about the theme that is not a setting: a newer release, whether this site
 * uses it, what it is, its colours and the integrations it needs.
 */
export class ThemeSettingsOverviewPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsOverviewPanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  @bound private activate(): void { void this.page.handleActivate(); }
  @bound private update(): void { void this.page.handleUpdate(); }

  private get dark(): boolean {
    return this.model.adminTheme === ThemeMode.DARK;
  }

  private get newerVersion(): string | null {
    const { marketplaceVersion, themeDetail } = this.model;
    return marketplaceVersion && marketplaceVersion !== themeDetail.version ? marketplaceVersion : null;
  }

  private updateBanner(version: string): ReactNode {
    const dark = this.dark;
    const updating = this.page.isUpdating;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <FrameworkIcons.Download size={16} className={dark ? 'text-indigo-300' : 'text-indigo-600'} />
        <span className={`flex-1 text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('themes.versionReady', { version })}</span>
        <button type="button" onClick={this.update} disabled={updating}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {updating ? <FrameworkIcons.Loader size={13} className="animate-spin" /> : <FrameworkIcons.Zap size={13} />}
          {updating ? AdminI18n.t('themes.updating') : AdminI18n.t('themes.updateAvailable')}
        </button>
      </div>
    );
  }

  private row(label: string, value: ReactNode): ReactNode {
    const dark = this.dark;
    return (
      <div key={label} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
        <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
        <span className={`text-right font-medium ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{value}</span>
      </div>
    );
  }

  private status(): ReactNode {
    const dark = this.dark;
    const active = this.model.themeDetail.state === ThemeState.ACTIVE;
    return (
      <DetailBox title={AdminI18n.t('themes.status')} theme={this.model.adminTheme}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-1.5 text-[13px]">
          <span className={`flex items-center gap-2 font-medium ${active ? 'text-emerald-500' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            {AdminI18n.t(active ? 'themes.active' : 'themes.inactive')}
          </span>
          {active ? null : (
            <button type="button" onClick={this.activate} className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white hover:bg-indigo-500">
              {AdminI18n.t('themes.activate')}
            </button>
          )}
        </div>
        {active ? null : <p className={`mt-2 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{AdminI18n.t('themes.notActiveHint')}</p>}
      </DetailBox>
    );
  }

  private details(): ReactNode {
    const { themeDetail, adminTheme } = this.model;
    return (
      <DetailBox title={AdminI18n.t('themes.details')} theme={adminTheme}>
        {this.row(AdminI18n.t('themes.version'), themeDetail.version)}
        {this.newerVersion ? this.row(AdminI18n.t('themes.availableVersion'), this.newerVersion) : null}
        {themeDetail.author ? this.row(AdminI18n.t('themes.author'), themeDetail.author) : null}
      </DetailBox>
    );
  }

  render(): ReactNode {
    const model = this.model;
    const version = this.newerVersion;
    const { themeDetail, adminTheme } = model;
    // The layout the site's pages get when they choose none: the site's own saved choice, else the theme's.
    const defaultLayout = String(this.page.dbConfig.defaultLayout || '') || themeDetail.defaultLayout || '';
    return (
      <DetailSplit theme={adminTheme}
        main={<>
          {version ? this.updateBanner(version) : null}
          <p className={`text-[15px] leading-relaxed ${this.dark ? 'text-slate-300' : 'text-slate-700'}`}>
            {themeDetail.description || AdminI18n.t('themes.noDescriptionProvidedForThis')}
          </p>
          <ThemeOverviewColours swatches={model.previewSwatches} theme={adminTheme} />
          <ThemeOverviewLayouts layouts={themeDetail.layouts ?? []} defaultLayout={defaultLayout} theme={adminTheme} />
          {model.integrationRequirements.length ? <ThemeOverviewIntegrations integrations={model.integrationRequirements} theme={adminTheme} /> : null}
        </>}
        aside={<>
          {this.status()}
          {this.details()}
        </>} />
    );
  }
}
