"use client";

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';

export class ThemeSettingsSidebar extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { adminTheme, themeDetail, marketplaceVersion, integrationRequirements, livePreviewUrl } = model;
    const { previewPrimary, previewBackground, previewForeground, previewMuted, previewCard, previewAccent } = model;
    const { isUpdating, isReseeding, isResettingTheme } = page.state;
    return (
      <div className="space-y-8">
        <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-8 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            Metadata Artifacts
          </h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Architect</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {themeDetail.author || 'Fromcode Official'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marketplace Version</span>
              <span className={`text-[11px] font-semibold ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                v{themeDetail.version}
              </span>
            </div>
          </div>

          {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
            <div className={`mt-8 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                onClick={() => void page.handleUpdate()}
                disabled={isUpdating}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <FrameworkIcons.Clock size={14} />
                {isUpdating ? 'Synchronizing...' : `Upgrade to v${marketplaceVersion}`}
              </button>
            </div>
          )}
        </Card>

        <Card className={`border-0 p-8 rounded-[2rem] overflow-hidden relative ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Visual Preview
            </h3>
            <a
              href={livePreviewUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${adminTheme === 'dark' ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <FrameworkIcons.ExternalLink size={11} />
              Open Site
            </a>
          </div>
          <div className="w-full rounded-2xl border p-3" style={{ borderColor: previewPrimary, backgroundColor: `${previewBackground}dd` }}>
            <div className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: `${previewPrimary}44`, backgroundColor: previewCard }}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: previewPrimary }} />
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: previewMuted }}>
                  Real-time Simulation Node
                </p>
              </div>
              <FrameworkIcons.Eye size={12} style={{ color: previewMuted }} />
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: `${previewPrimary}33`, backgroundColor: previewBackground, color: previewForeground }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: previewMuted }}>Theme Hero Simulation</p>
              <h4 className="mt-2 text-base font-bold leading-tight">Build faster with {themeDetail.name}</h4>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: previewMuted }}>
                Live palette + typography simulation from your current variable edits.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" className="rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: previewPrimary, color: previewBackground }}>
                  Primary CTA
                </button>
                <button type="button" className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: `${previewAccent}55`, color: previewAccent }}>
                  Secondary
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="h-6 rounded-lg" style={{ backgroundColor: previewPrimary }} />
              <div className="h-6 rounded-lg border" style={{ backgroundColor: previewBackground, borderColor: `${previewMuted}55` }} />
              <div className="h-6 rounded-lg" style={{ backgroundColor: previewForeground }} />
            </div>
          </div>
        </Card>

        <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-6 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            Theme Maintenance
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => page.openRunSeedsConfirm()}
              disabled={isReseeding || isResettingTheme}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isReseeding ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Refresh size={14} />}
              {isReseeding ? 'Running Seeds...' : 'Run Seeds'}
            </button>
            <button
              onClick={() => page.openResetThemeConfirm()}
              disabled={isReseeding || isResettingTheme}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isResettingTheme ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Warning size={14} />}
              {isResettingTheme ? 'Resetting Theme...' : 'Reset Theme + Seeds'}
            </button>
          </div>
          <p className={`mt-4 text-[10px] font-bold leading-relaxed ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            Run Seeds replays theme seed data. Reset Theme + Seeds clears saved theme config and replays seeds.
          </p>
        </Card>

        {integrationRequirements.length > 0 && (
          <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-6 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Integration Requirements
            </h3>
            <div className="space-y-3">
              {integrationRequirements.map((integration: any) => (
                <div key={integration.type} className={`p-4 rounded-xl border ${adminTheme === 'dark' ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {integration.label || integration.type}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {integration.description || `Configure ${integration.type} integration for this theme.`}
                      </p>
                    </div>
                    <Badge variant={integration.required === false ? 'gray' : 'warning'}>
                      {integration.required === false ? 'Optional' : 'Required'}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Link href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(integration.type)} className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-600">
                      Open Integration Settings
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className={`border-0 p-10 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-red-500/10 border border-red-500/20 shadow-2xl shadow-red-500/5' : 'bg-red-50 border border-red-100 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-6">
            <FrameworkIcons.Warning size={18} className="text-red-500" />
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${adminTheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              System Purge
            </h3>
          </div>
          <p className={`text-[11px] font-bold leading-relaxed mb-8 ${adminTheme === 'dark' ? 'text-red-300/70' : 'text-red-700/70'}`}>
            {themeDetail.state === 'active'
              ? 'This theme is currently active. On delete, the system will switch to another theme if available, or continue with no active theme.'
              : 'Removing this theme artifact is permanent. All local layout variations will be destroyed.'}
          </p>
          <button
            onClick={() => page.openDeleteConfirm()}
            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-semibold uppercase tracking-wide rounded-2xl transition-all shadow-xl shadow-black/10 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
          >
            {themeDetail.state === 'active' ? 'Switch & Destroy Theme' : 'Destroy Theme'}
          </button>
        </Card>
      </div>
    );
  }
}
