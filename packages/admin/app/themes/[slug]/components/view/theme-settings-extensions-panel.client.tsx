import { ThemeConfigFieldType, ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import Link from 'next/link';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { UiFieldUtils } from '@/lib/ui';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ThemeSettingsExtensionsPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsExtensionsPanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  /** Who writes a structured setting — the admin cannot, so it names the source instead. */
  private static provenanceOf(key: string, model: ThemeSettingsRenderModel): string {
    const storedForSite = Object.prototype.hasOwnProperty.call(model.storedSettings, key);
    return storedForSite
      ? AdminI18n.t('themes.storedInThisSiteS')
      : AdminI18n.t('themes.defaultDeclaredByTheTheme');
  }

  render(): ReactNode {
    const page = this.page;
    const model = this.model;
    const { adminTheme, tempSettings, groupedThemeSettings, themeSettingsSchema, allThemeSettingKeys } = model;
    if (!allThemeSettingKeys.length) return null;
    return (
        <div className="space-y-5">
          {Object.entries(groupedThemeSettings).map(([group, keys]) => (
            <div key={group} className="space-y-4">
              <h3 className={`text-[13px] font-semibold ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{group === 'General' ? AdminI18n.t('themes.general') : group}</h3>
              {keys.map((key) => {
                const schema = themeSettingsSchema[key];
                const rawValue = tempSettings[key];
                // Enum MEMBERS — `ThemeRecordHydrator` resolved `schema.type` at the fetch boundary. The
                // old `inferredType as 'text' | 'number' | …` cast asserted a union the value never had.
                const type = schema?.type
                  ?? (typeof rawValue === 'boolean'
                    ? ThemeConfigFieldType.BOOLEAN
                    : typeof rawValue === 'number' ? ThemeConfigFieldType.NUMBER : ThemeConfigFieldType.TEXT);
                // An object/array value has no single input that can hold it: `String(value)` painted
                // "[object Object]" into a text box, and saving the page wrote that string over the real
                // config. It renders read-only instead and never calls `handleSettingChange`, so the save
                // sends the stored value back untouched.
                const isStructured = type === ThemeConfigFieldType.JSON || (rawValue !== null && typeof rawValue === 'object');

                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <label className={UiFieldUtils.TEXT.LABEL}>{schema?.label || key}</label>
                        {schema?.description && (
                          <p className="text-[11px] text-slate-500 mt-1">{schema.description}</p>
                        )}
                      </div>
                      {schema?.integrationType && (
                        <Link href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(schema.integrationType)} className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-600">
                          {AdminI18n.t('themes.openIntegration')}
                        </Link>
                      )}
                    </div>

                    {isStructured ? (
                      <>
                        <StructuredReadOnlyField value={rawValue} theme={adminTheme} />
                        <p className="text-[11px] text-slate-500 mt-2">{ThemeSettingsExtensionsPanel.provenanceOf(key, model)}</p>
                      </>
                    ) : type === ThemeConfigFieldType.BOOLEAN ? (
                      <Switch checked={Boolean(rawValue)} onChange={(checked) => page.handleSettingChange(key, checked)} />
                    ) : type === ThemeConfigFieldType.SELECT ? (
                      <Select
                        value={String(rawValue ?? '')}
                        onChange={(nextValue) => page.handleSettingChange(key, String(nextValue ?? ''))}
                        options={(schema?.options || []).map((opt) => ({ value: String(opt.value), label: opt.label }))}
                        placeholder={schema?.placeholder || AdminI18n.t('themes.selectValue')}
                        searchable={false}
                        theme={adminTheme}
                        className="w-full"
                      />
                    ) : type === ThemeConfigFieldType.NUMBER ? (
                      <NumberStepper
                        min={0}
                        value={typeof rawValue === 'number' ? rawValue : String(rawValue ?? '')}
                        onChange={(v) => page.handleSettingChange(key, v === '' ? '' : Number(v))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(rawValue ?? '')}
                        onChange={(e) => page.handleSettingChange(key, e.target.value)}
                        placeholder={schema?.placeholder || (type === ThemeConfigFieldType.INTEGRATION ? AdminI18n.t('themes.integrationValue') : '')}
                        className={UiFieldUtils.getFieldClasses()}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
    );
  }
}
