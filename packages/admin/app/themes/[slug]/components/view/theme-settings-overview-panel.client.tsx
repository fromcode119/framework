import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Hint } from '@/components/ui/view/hint.client';
import { Text } from '@/components/ui/view/text.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeState, VersionComparisonService } from '@fromcode119/core/client';
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

  private get newerVersion(): string | null {
    const { marketplaceVersion, themeDetail } = this.model;
    return marketplaceVersion && VersionComparisonService.isGreater(marketplaceVersion, themeDetail.version) ? marketplaceVersion : null;
  }

  private updateBanner(version: string): ReactNode {
    const updating = this.page.isUpdating;
    return (
      <Alert tone="info" title={AdminI18n.t('themes.versionReady', { version })}
        action={<Button variant={ButtonVariant.PRIMARY} isLoading={updating} icon={<FrameworkIcons.Zap size={15} />} onClick={this.update}>{updating ? AdminI18n.t('themes.updating') : AdminI18n.t('themes.updateAvailable')}</Button>} />
    );
  }

  private status(): ReactNode {
    const active = this.model.themeDetail.state === ThemeState.ACTIVE;
    return (
      <DetailBox title={AdminI18n.t('themes.status')} theme={this.model.adminTheme}
        action={<StateBadge tone={active ? 'success' : 'default'}>{AdminI18n.t(active ? 'themes.active' : 'themes.inactive')}</StateBadge>}>
        {active ? null : (
          <div className="fc-stack">
            <Hint>{AdminI18n.t('themes.notActiveHint')}</Hint>
            <div><Button variant={ButtonVariant.PRIMARY} onClick={this.activate}>{AdminI18n.t('themes.activate')}</Button></div>
          </div>
        )}
      </DetailBox>
    );
  }

  private details(): ReactNode {
    const { themeDetail, adminTheme } = this.model;
    const facts = [
      { key: 'version', label: AdminI18n.t('themes.version'), value: themeDetail.version },
      ...(this.newerVersion ? [{ key: 'available', label: AdminI18n.t('themes.availableVersion'), value: this.newerVersion }] : []),
      ...(themeDetail.author ? [{ key: 'author', label: AdminI18n.t('themes.author'), value: String(themeDetail.author) }] : []),
      { key: 'vendor', label: AdminI18n.t('themes.vendor'), value: String(themeDetail.namespace || '').trim() || AdminI18n.t('themes.noVendorDeclared') },
    ];
    return <DetailBox title={AdminI18n.t('themes.details')} theme={adminTheme}><AdminFactGrid facts={facts as any} /></DetailBox>;
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
          <RecordCard><Text size="base">{themeDetail.description || AdminI18n.t('themes.noDescriptionProvidedForThis')}</Text></RecordCard>
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
