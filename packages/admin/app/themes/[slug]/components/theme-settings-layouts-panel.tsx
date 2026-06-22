"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeSettingsConstants } from './theme-settings-constants';

export class ThemeSettingsLayoutsPanel extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, themeDetail, tempLayouts, allVarKeys } = model;
    return (
      <>
        <Card className={`border-0 p-5 rounded-xl ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <FrameworkIcons.Box size={20} />
            </div>
            <div>
              <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Layout Protocols
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Map platform layouts to theme implementations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ThemeSettingsConstants.CORE_LAYOUTS.map(layout => {
              const activeLayout = themeDetail.layouts?.find((l: any) => l.name === tempLayouts[layout.id]);
              return (
                <div key={layout.id} className={`flex flex-col p-6 rounded-[2rem] transition-all duration-500 border ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5 focus-within:border-purple-500/30' : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] focus-within:shadow-xl focus-within:shadow-purple-500/10 focus-within:border-purple-500/20'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{layout.label}</div>
                      <p className="text-[9px] text-slate-400 font-medium italic leading-tight max-w-[150px]">
                        {layout.description}
                      </p>
                    </div>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${activeLayout ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                      <FrameworkIcons.Box size={14} />
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Select
                      value={tempLayouts[layout.id] || ''}
                      onChange={(nextValue) => page.handleLayoutChange(layout.id, String(nextValue || ''))}
                      options={[
                        { value: '', label: 'System Default' },
                        ...(themeDetail.layouts?.map((l: any) => ({ value: l.name, label: l.label })) || [])
                      ]}
                      placeholder="System Default"
                      searchable={false}
                      theme={adminTheme}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {themeDetail.overrides && themeDetail.overrides.length > 0 && (
          <Card className={`border-0 p-5 rounded-xl ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <FrameworkIcons.Zap size={20} />
              </div>
              <div>
                <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  UI Overrides
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Components hard-coded for replacement by this theme.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {themeDetail.overrides.map((o: any) => (
                <div key={o.name} className={`p-5 rounded-3xl border flex items-center gap-3 ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  </div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {o.name}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!allVarKeys.length && (
          <Card className={`border-0 p-20 flex flex-col items-center justify-center rounded-[3rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
            <FrameworkIcons.Help size={32} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">No configurable protocols found</p>
          </Card>
        )}
      </>
    );
  }
}
