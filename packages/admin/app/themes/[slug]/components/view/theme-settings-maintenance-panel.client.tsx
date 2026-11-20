import { ThemeState } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The Maintenance tab: replaying the theme's seed data, resetting its settings, and deleting it — each confirmed first. */
export class ThemeSettingsMaintenancePanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsMaintenancePanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  @bound private runSeeds(): void { this.page.openRunSeedsConfirm(); }
  @bound private reset(): void { this.page.openResetThemeConfirm(); }
  @bound private remove(): void { this.page.openDeleteConfirm(); }

  private row(title: string, hint: string, action: ReactNode): ReactNode {
    return <SettingRow title={title} description={hint} width={SettingRowWidth.AUTO}>{action}</SettingRow>;
  }

  private button(label: string, onClick: () => void, busy: boolean, danger = false): ReactNode {
    const { isReseeding, isResettingTheme } = this.page;
    return (
      <Button size={FieldSize.SM} variant={danger ? ButtonVariant.DANGER : ButtonVariant.SECONDARY} onClick={onClick}
        isLoading={busy} disabled={isReseeding || isResettingTheme}>
        {label}
      </Button>
    );
  }

  render(): ReactNode {
    const { isReseeding, isResettingTheme } = this.page;
    const active = this.model.themeDetail.state === ThemeState.ACTIVE;
    return (
      <Card noPadding>
        {this.row(AdminI18n.t('themes.runSeeds'), AdminI18n.t('themes.runSeedsHint'),
          this.button(isReseeding ? AdminI18n.t('themes.runningSeeds') : AdminI18n.t('themes.runSeeds'), this.runSeeds, isReseeding))}
        {this.row(AdminI18n.t('themes.resetThemeSeeds'), AdminI18n.t('themes.resetThemeHint'),
          this.button(isResettingTheme ? AdminI18n.t('themes.resettingTheme') : AdminI18n.t('themes.resetThemeSeeds'), this.reset, isResettingTheme))}
        {this.row(AdminI18n.t('themes.removeTheme'),
          active ? AdminI18n.t('themes.thisThemeIsCurrentlyActive') : AdminI18n.t('themes.removingThisThemeArtifactIs'),
          this.button(AdminI18n.t('themes.removeTheme'), this.remove, false, true))}
      </Card>
    );
  }
}
