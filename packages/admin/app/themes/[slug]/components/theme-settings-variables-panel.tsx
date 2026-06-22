"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeSettingsConstants } from './theme-settings-constants';

export class ThemeSettingsVariablesPanel extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, themeDetail, tempVariables, groupedVariables } = model;
    return (
      <>
        {Object.entries(groupedVariables).map(([group, keys]: [string, any]) => keys.length > 0 && (
          <Card key={group} className={`border-0 p-4 rounded-xl ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                <FrameworkIcons.Settings size={18} />
              </div>
              <div>
                <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {group} Protocols
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Configure {group.toLowerCase()} design variables.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {keys.map((key: string) => {
                const schema = themeDetail.variableSchema?.[key];
                const value = tempVariables[key];
                const type = schema?.type || (value?.startsWith('#') ? 'color' : 'text');

                return (
                  <div key={key} className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 border group ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5 focus-within:border-indigo-500/30' : 'bg-white border-slate-100 shadow-sm focus-within:shadow-md focus-within:border-indigo-500/20'}`}>
                    <div className="flex-1 mr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-[10px] font-semibold uppercase tracking-wide text-slate-500`}>{schema?.label || key}</div>
                        {schema?.description && (
                          <div className="group/tip relative flex items-center">
                            <FrameworkIcons.Help size={12} className="text-slate-500 cursor-help" />
                            <div className="absolute left-full ml-2 w-48 p-3 rounded-xl bg-slate-900 text-[10px] text-slate-300 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 font-medium">
                              {schema.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {type === 'select' ? (
                        <Select
                          value={value || ''}
                          onChange={(nextValue) => page.handleVariableChange(key, String(nextValue || ''))}
                          options={(schema?.options || []).map((opt: any) => ({ value: String(opt.value), label: opt.label }))}
                          placeholder="Select value"
                          searchable={false}
                          theme={adminTheme}
                          className="w-full"
                        />
                      ) : type === 'font' ? (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 relative group/font">
                            <input
                              type="text"
                              value={value}
                              onChange={e => page.handleVariableChange(key, e.target.value)}
                              placeholder="Inter, sans-serif"
                              list={`fonts-${key}`}
                              className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
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
                      ) : type === 'color' ? (
                        <ColorPicker value={value} onChange={(nextValue) => page.handleVariableChange(key, nextValue)} className="w-full" />
                      ) : type === 'image' ? (
                        <div className="flex items-center gap-4">
                          <input
                            type="text"
                            value={value}
                            onChange={e => page.handleVariableChange(key, e.target.value)}
                            placeholder="https://..."
                            className={`flex-1 bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                          />
                          {value && (
                            <img src={value} className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/20" alt="Preview" />
                          )}
                        </div>
                      ) : (
                        <input
                          type={type === 'number' ? 'number' : 'text'}
                          value={value}
                          onChange={e => page.handleVariableChange(key, e.target.value)}
                          className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
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
