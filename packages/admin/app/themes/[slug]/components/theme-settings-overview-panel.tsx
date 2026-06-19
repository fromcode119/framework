"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';

export class ThemeSettingsOverviewPanel extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, themeDetail } = model;
    return (
      <Card className={`border-0 relative overflow-hidden p-8 transition-all duration-500 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex items-start gap-8">
          <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${adminTheme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
            <FrameworkIcons.Palette size={48} strokeWidth={1} />
          </div>
          <div className="flex-1 space-y-4">
            <Badge variant="blue" className="px-3 py-1 font-semibold uppercase tracking-wide text-[10px] rounded-lg">
              Visual Package
            </Badge>
            <p className={`text-xl leading-relaxed font-medium italic ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {themeDetail.description || "No description provided for this theme."}
            </p>
          </div>
        </div>

        <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'}`}>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-6">Layout Architectures</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeDetail.layouts?.map((layout: any) => (
              <div key={layout.name} className={`p-6 rounded-3xl border transition-all ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                <div className={`text-sm font-semibold mb-1 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{layout.label}</div>
                <p className="text-[11px] text-slate-500 font-medium italic">{layout.description || 'Standard platform optimized layout.'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
          <div className="space-y-1">
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Deployment Status</div>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${themeDetail.state === 'active' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'bg-slate-500'}`} />
              <span className={`text-sm font-semibold uppercase tracking-tight ${themeDetail.state === 'active' ? 'text-green-500' : 'text-slate-500'}`}>
                System {themeDetail.state}
              </span>
            </div>
          </div>
          {themeDetail.state !== 'active' && (
            <button
              onClick={() => void page.handleActivate()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
            >
              Activate Environment
            </button>
          )}
        </div>
      </Card>
    );
  }
}
