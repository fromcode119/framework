import { ThemeMode } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SiteScopePanel } from '@/components/view/site-scope-panel.client';
import { RoutingPageActions } from '@/app/settings/routing/page-actions.client';
import { RoutingPageState } from '@/app/settings/routing/page-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';

/**
 * Routing — the permalink structure and what the home page serves.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows, how it resolves the
 * current home target and what it can save live in the links below — see `RoutingPageState`.
 */
export class RoutingPage extends RoutingPageActions {
  async componentDidMount(): Promise<void> {
    this.syncAutoSource();
    await this.loadRouting();
    this.scope = new SettingsPageScope(await PlatformSettingLocks.load(), ['permalink_structure', 'routing_home_target']);
  }

  componentDidUpdate(): void {
    this.scheduleHomeOptions();
    this.syncAutoSource();
  }

  componentWillUnmount(): void {
    if (this.optionsTimeout) clearTimeout(this.optionsTimeout);
    this.optionsTimeout = null;
    this.optionsRequestId += 1;
    this.autoRequestId += 1;
  }

  render() {
    if (this.isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader label={AdminI18n.t('settings.routing.loadingRoutingSettings')} />
        </div>
      );
    }

    const theme = this.theme;
    const structure = this.structure;
    const homeTarget = this.homeTarget;
    const resolvedSourceLabel = this.resolvedSourceLabel;

    if (structure === null || homeTarget === null) {
      return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <CompactPageHeader
            theme={theme}
            title={AdminI18n.t('settings.routing.routing')}
            subtitle={AdminI18n.t('settings.routing.homepageTargetPermalinkConfiguration')}
          />
          <LoadErrorPanel
            title={AdminI18n.t('settings.routing.routingSettingsCouldNotBe')}
            message={this.loadError || AdminI18n.t('settings.routing.theRoutingSettingsRequestFailed')}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('settings.routing.routing')}
          subtitle={AdminI18n.t('settings.routing.homepageTargetPermalinkConfiguration')}
        />

        {this.outOfScope && (
          <SiteScopePanel detail={AdminI18n.t('settings.routing.thePermalinkStructureAndThe')} />
        )}

        {!this.outOfScope && (
        <div className="p-6 w-full space-y-3">
          <Card title={AdminI18n.t('settings.routing.homepageTarget')}>
            <SettingRow
              title={AdminI18n.t('settings.routing.rootRoute')}
              description={AdminI18n.t('settings.routing.targetsAreDiscoveredFromAvailable')}
            >
              <Select
                value={homeTarget}
                onChange={this.setHomeTarget}
                options={this.homeOptions}
                placeholder={AdminI18n.t('settings.routing.selectHomepageTarget')}
                theme={theme}
                searchable
                onSearchChange={this.setSearchTerm}
              />
            </SettingRow>
            <SettingRow title={AdminI18n.t('settings.routing.resolvedHomepageSource')} width={SettingRowWidth.AUTO}>
              <span className="text-[13px] font-medium">{resolvedSourceLabel}</span>
            </SettingRow>
          </Card>

          <Card title={AdminI18n.t('settings.routing.permalinkStructure')}>
            <div className="space-y-8 py-4">
              <div>
                <label className={`block text-[12px] font-medium mb-3 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  {AdminI18n.t('settings.routing.commonStructures')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RoutingPageState.PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => this.setStructure(preset.value)}
                      className={`flex items-center justify-between p-4 rounded-xl border text-start transition-all ${structure === preset.value
                          ? 'border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600'
                          : theme === ThemeMode.DARK
                            ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${structure === preset.value ? 'text-indigo-400' : 'text-slate-500'
                          }`}>
                          {preset.label}
                        </span>
                        <code className={`text-sm ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-800'}`}>
                          {preset.value}
                        </code>
                      </div>
                      {structure === preset.value && <FrameworkIcons.Check size={20} className="text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-xl border-2 border-dashed ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'
                }`}>
                <label className={`block text-[12px] font-medium mb-4 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  {AdminI18n.t('settings.routing.customStructure')}
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-sm whitespace-nowrap">https://yourdomain.com</span>
                    <Input
                      value={structure}
                      onChange={(e) => this.setStructure(e.target.value)}
                      placeholder="/:year/:slug"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title={AdminI18n.t('settings.routing.availablePlaceholders')}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
              {RoutingPageState.PLACEHOLDERS.map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => this.appendPlaceholder(tag.label)}
                  className={`p-5 rounded-xl border text-start transition-all hover:scale-[1.02] group ${theme === ThemeMode.DARK
                      ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'
                      : 'border-slate-100 bg-white hover:shadow-xl hover:shadow-indigo-600/5'
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-indigo-500 font-semibold text-sm px-2 py-1 bg-indigo-500/10 rounded-lg">
                      {tag.label}
                    </code>
                    <FrameworkIcons.Plus size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className={`text-[12px] font-bold mb-1 ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>
                    {tag.description}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {AdminI18n.t('settings.routing.example')} <span className="italic">{tag.example}</span>
                  </p>
                </button>
              ))}
            </div>
          </Card>
          <SettingsSaveBar dirty={this.isDirty} saving={this.isSaving} onSave={this.handleSave} onDiscard={this.discardChanges} />
        </div>
        )}
      </div>
    );
  }
}
