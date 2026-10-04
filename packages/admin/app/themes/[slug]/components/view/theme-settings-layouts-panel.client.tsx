import { ThemeMode, LocalizationUtils } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { UiFieldUtils } from '@/lib/ui';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ThemeSettingsLayoutsPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsLayoutsPanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const { adminTheme, themeDetail, tempDefaultLayout } = this.model;
    const layouts = themeDetail.layouts || [];
    const themeDefault = layouts.find((l) => l.name === themeDetail.defaultLayout);
    const themeDefaultLabel = LocalizationUtils.resolveLabelText(themeDefault?.label, AdminI18n.locale) || themeDetail.defaultLayout || '';
    // A saved choice the theme no longer declares is not applied by the storefront — say so here
    // instead of showing a select that looks set but does nothing.
    const isUnavailable = Boolean(tempDefaultLayout) && !layouts.some((l) => l.name === tempDefaultLayout);
    const selected = layouts.find((l) => l.name === (tempDefaultLayout || themeDetail.defaultLayout));
    return (
      <div className="space-y-6">
        <div>
          <label className={UiFieldUtils.TEXT.LABEL}>{AdminI18n.t('themes.defaultLayout')}</label>
          <p className="mb-2 text-xs text-slate-500">{AdminI18n.t('themes.layoutForPagesThatDo')}</p>
          <div className="flex max-w-md flex-col">
            <Select
              value={tempDefaultLayout}
              onChange={(nextValue) => page.handleDefaultLayoutChange(String(nextValue || ''))}
              options={[
                { value: '', label: themeDefaultLabel ? AdminI18n.t('themes.themeDefault', { themeDefaultLabel: themeDefaultLabel }) : AdminI18n.t('themes.themeDefaultNoneDeclared') },
                ...(isUnavailable ? [{ value: tempDefaultLayout, label: AdminI18n.t('themes.notInThisTheme', { tempDefaultLayout: tempDefaultLayout }) }] : []),
                ...layouts.map((l) => ({ value: l.name, label: LocalizationUtils.resolveLabelText(l.label, AdminI18n.locale) || l.name })),
              ]}
              searchable={false}
              theme={adminTheme}
              className="w-full"
            />
            {LocalizationUtils.resolveLabelText(selected?.description, AdminI18n.locale) ? (
              <p className="text-[11px] text-slate-500 mt-2">{LocalizationUtils.resolveLabelText(selected?.description, AdminI18n.locale)}</p>
            ) : null}
            {isUnavailable ? (
              <p className="text-[11px] text-amber-600 mt-2">
                {AdminI18n.t('themes.layoutNoLongerProvided', { layout: tempDefaultLayout })}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500 mt-2">
              {AdminI18n.t('themes.aPageThatPicksA')}
            </p>
          </div>
        </div>

        {themeDetail.overrides && themeDetail.overrides.length > 0 && (
          <div>
            <label className={UiFieldUtils.TEXT.LABEL}>{AdminI18n.t('themes.uiOverrides')}</label>
            <p className="mb-2 text-xs text-slate-500">{AdminI18n.t('themes.componentsHardCodedForReplacement')}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {themeDetail.overrides.map((o) => (
                <code key={o.name} className={`text-[13px] ${adminTheme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-700'}`}>{o.name}</code>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}
