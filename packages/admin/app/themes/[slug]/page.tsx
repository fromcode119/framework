"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/admin-component';
import { ThemeSettingsController } from './components/theme-settings-controller';
import { ThemeSettingsRenderModel } from './components/theme-settings-render-model';
import { ThemeSettingsHeader } from './components/theme-settings-header';
import { ThemeSettingsOverviewPanel } from './components/theme-settings-overview-panel';
import { ThemeSettingsVariablesPanel } from './components/theme-settings-variables-panel';
import { ThemeSettingsLayoutsPanel } from './components/theme-settings-layouts-panel';
import { ThemeSettingsExtensionsPanel } from './components/theme-settings-extensions-panel';
import { ThemeSettingsSidebar } from './components/theme-settings-sidebar';
import { ThemeSettingsDialogs } from './components/theme-settings-dialogs';
import type { ThemeSettingsPageProps, ThemeSettingsPageState } from './theme-settings-page.interfaces';

export default class ThemeSettingsPage extends AdminComponent<ThemeSettingsPageProps, ThemeSettingsPageState> {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  state: ThemeSettingsPageState = {
    routeSlug: '',
    resolved: false,
    themeDetail: null,
    marketplaceVersion: null,
    loading: true,
    activeTab: 'overview',
    isUpdating: false,
    isSaving: false,
    isReseeding: false,
    isResettingTheme: false,
    isDeleting: false,
    isDeleteConfirmOpen: false,
    isRunSeedsConfirmOpen: false,
    isResetThemeConfirmOpen: false,
    dbConfig: {},
    tempVariables: {},
    tempLayouts: {},
    tempSettings: {},
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    const searchParams = this.props.searchParams ? await this.props.searchParams : undefined;
    if (!this.mounted) return;
    const tab = searchParams?.tab;
    const nextTab = tab === 'settings' || tab === 'overview' ? (tab as 'settings' | 'overview') : this.state.activeTab;
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    this.setState({ routeSlug: params.slug, resolved: true, activeTab: nextTab }, () => void ThemeSettingsController.fetchTheme(this));
  }

  componentDidUpdate(): void {
    if (this.state.resolved && this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
      void ThemeSettingsController.fetchTheme(this);
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  handleActivate(): Promise<void> { return ThemeSettingsController.handleActivate(this); }
  handleUpdate(): Promise<void> { return ThemeSettingsController.handleUpdate(this); }
  handleSaveConfig(): Promise<void> { return ThemeSettingsController.handleSaveConfig(this); }
  handleDelete(): Promise<void> { return ThemeSettingsController.handleDelete(this); }
  handleRunSeeds(): Promise<void> { return ThemeSettingsController.handleRunSeeds(this); }
  handleResetTheme(): Promise<void> { return ThemeSettingsController.handleResetTheme(this); }

  openDeleteConfirm(): void { if (this.state.themeDetail) this.setState({ isDeleteConfirmOpen: true }); }
  openRunSeedsConfirm(): void { if (this.state.themeDetail) this.setState({ isRunSeedsConfirmOpen: true }); }
  openResetThemeConfirm(): void { if (this.state.themeDetail) this.setState({ isResetThemeConfirmOpen: true }); }

  handleVariableChange(key: string, value: string): void {
    this.setState((prev) => ({ tempVariables: { ...prev.tempVariables, [key]: value } }));
  }

  handleLayoutChange(key: string, value: string): void {
    this.setState((prev) => ({ tempLayouts: { ...prev.tempLayouts, [key]: value } }));
  }

  handleSettingChange(key: string, value: any): void {
    this.setState((prev) => ({ tempSettings: { ...prev.tempSettings, [key]: value } }));
  }

  handleTabChange(tabId: 'overview' | 'settings'): void {
    this.setState({ activeTab: tabId });
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    params.set('tab', tabId);
    this.router.replace(`${this.pathname}?${params.toString()}`, { scroll: false });
  }

  render(): React.ReactElement | null {
    const model = ThemeSettingsRenderModel.build(this);
    if (model.loading) {
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <FrameworkIcons.Loader className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      );
    }
    if (!model.themeDetail) return null;
    const { adminTheme, activeTab } = model;
    const tabs = [
      { id: 'overview', label: 'Overview', icon: FrameworkIcons.Palette },
      { id: 'settings', label: 'Theme Builder', icon: FrameworkIcons.Box }
    ];

    return (
      <div className="w-full space-y-6 animate-in fade-in duration-500">
        <ThemeSettingsHeader page={this} model={model} />

        <div className={`flex gap-2 p-1.5 rounded-2xl w-fit backdrop-blur-xl border transition-all duration-300 ${adminTheme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => this.handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-all rounded-xl ${activeTab === tab.id ? (adminTheme === 'dark' ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50') : (adminTheme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
            <div className="lg:col-span-2 space-y-6">
              {activeTab === 'overview' && <ThemeSettingsOverviewPanel page={this} model={model} />}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <ThemeSettingsVariablesPanel page={this} model={model} />
                  <ThemeSettingsLayoutsPanel page={this} model={model} />
                  <ThemeSettingsExtensionsPanel page={this} model={model} />
                </div>
              )}
            </div>

            <ThemeSettingsSidebar page={this} model={model} />
          </div>
        </div>

        <ThemeSettingsDialogs page={this} model={model} />
      </div>
    );
  }
}
