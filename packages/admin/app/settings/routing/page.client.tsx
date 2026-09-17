import { ThemeMode } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SiteScopePanel } from '@/components/view/site-scope-panel.client';
import { RoutingPageActions } from '@/app/settings/routing/page-actions.client';
import { RoutingPageState } from '@/app/settings/routing/page-state.client';

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
          <Loader label="Loading routing settings..." />
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
            icon={<FrameworkIcons.Map size={18} strokeWidth={2} />}
            title="Routing"
            subtitle="Homepage target & permalink configuration"
          />
          <LoadErrorPanel
            title="Routing settings could not be loaded"
            message={this.loadError || 'The routing settings request failed.'}
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
          icon={<FrameworkIcons.Map size={18} strokeWidth={2} />}
          title="Routing"
          subtitle="Homepage target & permalink configuration"
          actions={
            this.outOfScope ? null : (
              <Button
                icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
                onClick={this.handleSave}
                isLoading={this.isSaving}
                className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              >
                Apply Routing
              </Button>
            )
          }
        />

        {this.outOfScope && (
          <SiteScopePanel detail="The permalink structure and the homepage target are stored per site. Choose a site from the site menu to configure its routing." />
        )}

        {!this.outOfScope && (
        <div className="p-6 w-full space-y-8">
          <Card title="Homepage Target">
            <div className="space-y-5 py-2">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Root Route (`/`)
                </label>
                <Select
                  value={homeTarget}
                  onChange={this.setHomeTarget}
                  options={this.homeOptions}
                  placeholder="Select homepage target"
                  theme={theme}
                  searchable
                  onSearchChange={this.setSearchTerm}
                />
                <p className="mt-3 text-[11px] text-slate-500 font-medium italic">
                  Targets are discovered from available theme layouts and public collections.
                </p>
                <div className={`mt-3 ${AdminClass.SURFACE} px-3 py-2 text-[11px] ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}>
                  <span className="font-semibold uppercase tracking-wide text-[10px] opacity-70">Resolved Homepage Source</span>
                  <div className="mt-1 font-semibold">{resolvedSourceLabel}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Permalink Structure">
            <div className="space-y-8 py-4">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Common Structures
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RoutingPageState.PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => this.setStructure(preset.value)}
                      className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${structure === preset.value
                          ? 'border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600'
                          : theme === ThemeMode.DARK
                            ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${structure === preset.value ? 'text-indigo-400' : 'text-slate-500'
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
                <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-4 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                  Custom Structure
                </label>
                <div className="flex gap-3">
                  <div className={`flex-1 flex items-center px-4 ${AdminClass.SURFACE} transition-all focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                    <span className="text-slate-400 font-mono text-sm border-r pr-3 mr-3 py-2.5">https://yourdomain.com</span>
                    <input
                      value={structure}
                      onChange={(e) => this.setStructure(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium py-2.5"
                      placeholder="/:year/:slug"
                    />
                  </div>
                  <Button onClick={this.handleSave} isLoading={this.isSaving} className="px-8 rounded-xl">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Available Placeholders">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
              {RoutingPageState.PLACEHOLDERS.map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => this.appendPlaceholder(tag.label)}
                  className={`p-5 rounded-xl border text-left transition-all hover:scale-[1.02] group ${theme === ThemeMode.DARK
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
                    Example: <span className="italic">{tag.example}</span>
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
        )}
      </div>
    );
  }
}
