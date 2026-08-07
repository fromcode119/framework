import { ThemeMode, ThemeSettingType } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { ColorPicker } from '@/components/ui/view/color-picker.client';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeSettingsConstants } from '@/app/themes/[slug]/components/constants/theme-settings.constants';
import { ThemeVariableControl } from '@/lib/theme-variable-control';
import { AdminClass } from '@/lib/admin-class';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';

export class ThemeSettingsVariablesPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsVariablesPanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const { adminTheme, themeDetail, tempVariables, groupedVariables } = this.model;
    return (
      <>
        {Object.entries(groupedVariables).map(([group, keys]) => keys.length > 0 && (
          <Card key={group} className={`border-0 p-4 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                <FrameworkIcons.Settings size={18} />
              </div>
              <div>
                <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                  {group} Protocols
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Configure {group.toLowerCase()} design variables.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {keys.map((key) => {
                const schema = themeDetail.variableSchema?.[key];
                const value = tempVariables[key];
                // Enum MEMBERS — `ThemeRecordHydrator` resolved `schema.type` at the fetch boundary, so
                // `type === 'color'` would compare an object to a string and never match. The declared/
                // inferred rule lives in `ThemeVariableControl` so the Visual Preview shows a swatch for
                // exactly the keys that get a ColorPicker here.
                const type = ThemeVariableControl.resolveType(schema?.type, value);

                return (
                  <div key={key} className={`flex items-center justify-between p-4 ${AdminClass.SURFACE} transition-all duration-300 border group ${adminTheme === ThemeMode.DARK ? 'bg-slate-800/30 border-white/5 focus-within:border-indigo-500/30' : 'bg-white border-slate-100 shadow-sm focus-within:shadow-md focus-within:border-indigo-500/20'}`}>
                    <div className="flex-1 mr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-[10px] font-semibold uppercase tracking-wide text-slate-500`}>{schema?.label || key}</div>
                        {schema?.description && (
                          <div className="group/tip relative flex items-center">
                            <FrameworkIcons.Help size={12} className="text-slate-500 cursor-help" />
                            <div className={`absolute left-full ml-2 w-48 p-3 ${AdminClass.SURFACE} text-[10px] text-slate-300 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 font-medium`}>
                              {schema.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {type === ThemeSettingType.SELECT ? (
                        <Select
                          value={value || ''}
                          onChange={(nextValue) => page.handleVariableChange(key, String(nextValue || ''))}
                          options={(schema?.options || []).map((opt) => ({ value: String(opt.value), label: opt.label }))}
                          placeholder="Select value"
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
                              placeholder="Inter, sans-serif"
                              list={`fonts-${key}`}
                              className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}
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
                            className={`flex-1 bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}
                          />
                          {value && (
                            <img src={value} className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/20" alt="Preview" />
                          )}
                        </div>
                      ) : (
                        <input
                          type={type === ThemeSettingType.NUMBER ? 'number' : 'text'}
                          value={value}
                          onChange={e => page.handleVariableChange(key, e.target.value)}
                          className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </>
    );
  }
}
