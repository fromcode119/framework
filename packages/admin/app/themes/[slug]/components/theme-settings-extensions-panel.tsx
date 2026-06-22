"use client";

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';

export class ThemeSettingsExtensionsPanel extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, tempSettings, groupedThemeSettings, themeSettingsSchema, allThemeSettingKeys } = model;
    if (!allThemeSettingKeys.length) return null;
    return (
      <Card className={`border-0 p-5 rounded-xl ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
            <FrameworkIcons.Settings size={20} />
          </div>
          <div>
            <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Theme Extensions
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">
              Integration links and additional configurable settings.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {Object.entries(groupedThemeSettings).map(([group, keys]: [string, any]) => (
            <div key={group} className="space-y-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{group}</h4>
              {keys.map((key: string) => {
                const schema = themeSettingsSchema[key];
                const rawValue = tempSettings[key];
                const inferredType = schema?.type || (typeof rawValue === 'boolean' ? 'boolean' : typeof rawValue === 'number' ? 'number' : 'text');
                const type = inferredType as 'text' | 'number' | 'boolean' | 'select' | 'integration' | 'json';

                return (
                  <div key={key} className={`p-6 rounded-2xl border transition-all ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]'}`}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {schema?.label || key}
                        </div>
                        {schema?.description && (
                          <p className="text-[11px] text-slate-500 mt-1">{schema.description}</p>
                        )}
                      </div>
                      {schema?.integrationType && (
                        <Link href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(schema.integrationType)} className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-600">
                          Open Integration
                        </Link>
                      )}
                    </div>

                    {type === 'boolean' ? (
                      <Switch checked={Boolean(rawValue)} onChange={(checked) => page.handleSettingChange(key, checked)} />
                    ) : type === 'select' ? (
                      <Select
                        value={String(rawValue ?? '')}
                        onChange={(nextValue) => page.handleSettingChange(key, String(nextValue ?? ''))}
                        options={(schema?.options || []).map((opt: any) => ({ value: String(opt.value), label: opt.label }))}
                        placeholder={schema?.placeholder || 'Select value'}
                        searchable={false}
                        theme={adminTheme}
                        className="w-full"
                      />
                    ) : type === 'number' ? (
                      <input
                        type="number"
                        value={rawValue ?? ''}
                        onChange={(e) => { const next = e.target.value; page.handleSettingChange(key, next === '' ? '' : Number(next)); }}
                        className={`w-full rounded-xl px-4 py-2 text-sm font-semibold border ${adminTheme === 'dark' ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      />
                    ) : type === 'json' ? (
                      <textarea
                        rows={4}
                        value={typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? {}, null, 2)}
                        onChange={(e) => page.handleSettingChange(key, e.target.value)}
                        placeholder={schema?.placeholder || '{ }'}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-medium border ${adminTheme === 'dark' ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={rawValue ?? ''}
                        onChange={(e) => page.handleSettingChange(key, e.target.value)}
                        placeholder={schema?.placeholder || (type === 'integration' ? 'Integration value' : '')}
                        className={`w-full rounded-xl px-4 py-2 text-sm font-semibold border ${adminTheme === 'dark' ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    );
  }
}
