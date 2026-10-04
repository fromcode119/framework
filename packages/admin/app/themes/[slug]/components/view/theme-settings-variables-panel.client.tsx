import { ThemeMode, ThemeSettingType } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { ColorPicker } from '@/components/ui/view/color-picker.client';
import { ThemeSettingsConstants } from '@/app/themes/[slug]/components/constants/theme-settings.constants';
import { ThemeVariableControl } from '@/lib/theme-variable-control';
import { UiFieldUtils } from '@/lib/ui';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ThemeSettingsVariablesPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsVariablesPanel, 'page' | 'model' | 'group'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;
  /** The variable group this section edits — one group per entry of the Settings tab's second row. */
  @prop declare group: string;

  render(): ReactNode {
    const page = this.page;
    const { adminTheme, themeDetail, tempVariables, groupedVariables } = this.model;
    const keys = groupedVariables[this.group] ?? [];
    return (
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              {keys.map((key) => {
                const schema = themeDetail.variableSchema?.[key];
                const value = tempVariables[key];
                // Enum MEMBERS — `ThemeRecordHydrator` resolved `schema.type` at the fetch boundary, so
                // `type === 'color'` would compare an object to a string and never match. The declared/
                // inferred rule lives in `ThemeVariableControl` so the Visual Preview shows a swatch for
                // exactly the keys that get a ColorPicker here.
                const type = ThemeVariableControl.resolveType(schema?.type, value);

                return (
                  <div key={key} className="flex flex-col gap-1">
                    <div>
                      <label className={UiFieldUtils.TEXT.LABEL}>{schema?.label || key}</label>
                      {type === ThemeSettingType.SELECT ? (
                        <Select
                          value={value || ''}
                          onChange={(nextValue) => page.handleVariableChange(key, String(nextValue || ''))}
                          options={(schema?.options || []).map((opt) => ({ value: String(opt.value), label: opt.label }))}
                          placeholder={AdminI18n.t('themes.selectValue')}
                          searchable={false}
                          theme={adminTheme}
                          className="w-full"
                        />
                      ) : type === ThemeSettingType.FONT ? (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 relative group/font">
                            <input
                              type="text"
                              value={value}
                              onChange={e => page.handleVariableChange(key, e.target.value)}
                              placeholder={ThemeSettingsConstants.GOOGLE_FONTS[0].value}
                              list={`fonts-${key}`}
                              className={UiFieldUtils.getFieldClasses()}
                            />
                            <datalist id={`fonts-${key}`}>
                              {ThemeSettingsConstants.GOOGLE_FONTS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </datalist>
                          </div>
                          <div className={`text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wide min-w-[40px] text-center`} style={{ fontFamily: value }}>
                            ABC
                          </div>
                        </div>
                      ) : type === ThemeSettingType.COLOR ? (
                        <ColorPicker value={value} onChange={(nextValue) => page.handleVariableChange(key, nextValue)} className="w-full" />
                      ) : type === ThemeSettingType.IMAGE ? (
                        <div className="flex items-center gap-4">
                          <input
                            type="text"
                            value={value}
                            onChange={e => page.handleVariableChange(key, e.target.value)}
                            placeholder="https://..."
                            className={UiFieldUtils.getFieldClasses(undefined, 'flex-1')}
                          />
                          {value && (
                            <img src={value} className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/20" alt={AdminI18n.t('themes.preview')} />
                          )}
                        </div>
                      ) : (
                        <input
                          type={type === ThemeSettingType.NUMBER ? 'number' : 'text'}
                          value={value}
                          onChange={e => page.handleVariableChange(key, e.target.value)}
                          className={UiFieldUtils.getFieldClasses()}
                        />
                      )}
                      {schema?.description ? <p className="mt-1 text-xs text-slate-500">{schema.description}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
    );
  }
}
