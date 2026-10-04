import { ThemeMode, ThemeState } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
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
    const dark = this.model.adminTheme === ThemeMode.DARK;
    return (
      <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</div>
          <div className={`mt-0.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</div>
        </div>
        {action}
      </div>
    );
  }

  private button(label: string, onClick: () => void, busy: boolean, danger = false): ReactNode {
    const dark = this.model.adminTheme === ThemeMode.DARK;
    const { isReseeding, isResettingTheme } = this.page;
    const tone = danger
      ? (dark ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10' : 'border-rose-300 text-rose-600 hover:bg-rose-50')
      : (dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50');
    return (
      <button type="button" onClick={onClick} disabled={isReseeding || isResettingTheme}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium disabled:opacity-50 ${tone}`}>
        {busy ? <FrameworkIcons.Loader size={13} className="animate-spin" /> : null}
        {label}
      </button>
    );
  }

  render(): ReactNode {
    const { isReseeding, isResettingTheme } = this.page;
    const active = this.model.themeDetail.state === ThemeState.ACTIVE;
    return (
      <div className={`divide-y ${this.model.adminTheme === ThemeMode.DARK ? 'divide-slate-800' : 'divide-slate-200'}`}>
        {this.row(AdminI18n.t('themes.runSeeds'), AdminI18n.t('themes.runSeedsHint'),
          this.button(isReseeding ? AdminI18n.t('themes.runningSeeds') : AdminI18n.t('themes.runSeeds'), this.runSeeds, isReseeding))}
        {this.row(AdminI18n.t('themes.resetThemeSeeds'), AdminI18n.t('themes.resetThemeHint'),
          this.button(isResettingTheme ? AdminI18n.t('themes.resettingTheme') : AdminI18n.t('themes.resetThemeSeeds'), this.reset, isResettingTheme))}
        {this.row(AdminI18n.t('themes.removeTheme'),
          active ? AdminI18n.t('themes.thisThemeIsCurrentlyActive') : AdminI18n.t('themes.removingThisThemeArtifactIs'),
          this.button(AdminI18n.t('themes.removeTheme'), this.remove, false, true))}
      </div>
    );
  }
}
