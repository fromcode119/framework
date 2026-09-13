import { ThemeMode } from '@fromcode119/core/client';
import { SystemConstants } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { state, bound } from '@fromcode119/react-class-components';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { Select } from '@/components/ui/view/select.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { CertificatesSettingsCard } from '@/app/settings/infrastructure/certificates-settings-card';
import { RestartServicesCard } from '@/app/settings/infrastructure/restart-services-card';

export class InfrastructureSettingsPage extends AdminComponent {
  @state isLoading = true;
  /**
   * `null` means NEVER LOADED. The load had no `catch`, so a failed settings GET left this at its
   * seeded `false` and the switch rendered "Maintenance Mode: off" — a positive claim about the
   * platform's state that nothing had read. Flipping it then wrote that guess back.
   */
  @state maintenance: boolean | null = null;
  @state loadError: string | null = null;
  /** Days of `_system_logs` history to keep. '' / '0' means keep forever — the description says so. */
  @state logRetentionDays = '';
  @state ssrGenerationCap = '';
  /** T5b render hosts: '' = the declared defaults. */
  @state ssrRenderMemoryMb = '';
  @state ssrRenderTimeoutMs = '';
  /** T5 plugin isolation: '' = the declared default (isolated). */
  @state isolationDefault = '';
  @state isolationMemoryMb = '';
  @state isolationTimeoutMs = '';
  @state isSavingIsolation = false;
  @state isSavingRetention = false;
  @state isSavingSsrCap = false;

  /**
   * Every control on this screen writes a PLATFORM setting — maintenance mode, the render worlds the
   * storefront keeps resident, the plugin isolation limits. They apply to every site on the box, the
   * API refuses them for anyone but a platform admin, and a site administrator reading its own site's
   * settings has no business being shown them at all. Say so instead of loading a form that cannot save.
   */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  async componentDidMount() {
    if (!this.canManagePlatform) {
      this.isLoading = false;
      return;
    }
    await this.loadMaintenance();
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadMaintenance();
  }

  private async loadMaintenance(): Promise<void> {
    this.loadError = null;
    try {
      const response = await AdminSystemSettingsClient.getAll();
      this.maintenance = response?.maintenance_mode === true || response?.maintenance_mode === 'true';
      this.logRetentionDays = String(response?.log_retention_days ?? '');
      this.ssrGenerationCap = String(response?.ssr_generation_cap ?? '');
      this.ssrRenderMemoryMb = String(response?.ssr_render_memory_mb ?? '');
      this.ssrRenderTimeoutMs = String(response?.ssr_render_timeout_ms ?? '');
      this.isolationDefault = String(response?.plugin_isolation_default ?? '');
      this.isolationMemoryMb = String(response?.plugin_isolation_memory_mb ?? '');
      this.isolationTimeoutMs = String(response?.plugin_isolation_timeout_ms ?? '');
    } catch (err: any) {
      this.maintenance = null;
      this.loadError = err?.message || 'The system settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  @bound
  async toggleMaintenance(val: boolean) {
    const addNotification = this.runtime.notify.addNotification;
    if (this.maintenance === null) return;
    const previous = this.maintenance;
    this.maintenance = val;
    try {
      await AdminSystemSettingsClient.update({ maintenance_mode: val });
      addNotification({ title: 'System Updated', message: `Maintenance mode is now ${val ? 'active' : 'inactive'}.`, type: NotificationType.INFO });
    } catch (err: any) {
      // The switch must not keep showing the position the write failed to reach.
      this.maintenance = previous;
      addNotification({ title: 'Error', message: err?.message || 'Failed to toggle maintenance mode.', type: NotificationType.ERROR });
    }
  }

  @bound
  onRetentionChange(value: number | string): void {
    this.logRetentionDays = String(value);
  }

  @bound
  async saveRetention(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingRetention = true;
    try {
      await AdminSystemSettingsClient.update({ log_retention_days: this.logRetentionDays });
      const days = Number(this.logRetentionDays);
      addNotification({
        title: 'System Updated',
        message: days > 0 ? `System logs older than ${days} day(s) will be removed.` : 'System logs are kept forever.',
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save log retention.', type: NotificationType.ERROR });
    } finally {
      this.isSavingRetention = false;
    }
  }

  @bound
  onSsrCapChange(value: number | string): void {
    this.ssrGenerationCap = String(value);
  }

  @bound onSsrRenderMemory(value: number | string): void { this.ssrRenderMemoryMb = String(value); }
  @bound onSsrRenderTimeout(value: number | string): void { this.ssrRenderTimeoutMs = String(value); }

  @bound
  async saveSsrCap(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingSsrCap = true;
    try {
      await AdminSystemSettingsClient.update({
        ssr_generation_cap: this.ssrGenerationCap,
        ssr_render_memory_mb: this.ssrRenderMemoryMb,
        ssr_render_timeout_ms: this.ssrRenderTimeoutMs,
      });
      const cap = Number(this.ssrGenerationCap);
      addNotification({
        title: 'System Updated',
        message: cap >= 1
          ? `The storefront keeps up to ${cap} theme world(s) resident. Memory and deadline apply to render hosts started from now on.`
          : `The storefront uses its default of ${SystemConstants.SSR_GENERATION_CAP_DEFAULT} resident theme world(s). Memory and deadline apply to render hosts started from now on.`,
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save the server rendering cap.', type: NotificationType.ERROR });
    } finally {
      this.isSavingSsrCap = false;
    }
  }

  @bound onIsolationDefault(value: string): void { this.isolationDefault = value; }
  @bound onIsolationMemory(value: number | string): void { this.isolationMemoryMb = String(value); }
  @bound onIsolationTimeout(value: number | string): void { this.isolationTimeoutMs = String(value); }

  @bound
  async saveIsolation(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSavingIsolation = true;
    try {
      await AdminSystemSettingsClient.update({
        plugin_isolation_default: this.isolationDefault,
        plugin_isolation_memory_mb: this.isolationMemoryMb,
        plugin_isolation_timeout_ms: this.isolationTimeoutMs,
      });
      addNotification({ title: 'System Updated', message: 'Plugin isolation settings saved. They apply to plugin processes started from now on; restart the API to apply them to every plugin.', type: NotificationType.INFO });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err?.message || 'Failed to save the plugin isolation settings.', type: NotificationType.ERROR });
    } finally {
      this.isSavingIsolation = false;
    }
  }

  render(): ReactNode {
    const theme = this.theme;

    if (this.isLoading) return <div className="p-12"><Loader label="Loading infrastructure settings..." /></div>;

    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail="Maintenance mode, render capacity and plugin isolation are properties of the server every site on this platform runs on, so only a platform admin can change them. Your own site's settings are under Settings — General, Localization and each plugin's own configuration." />
      );
    }

    return (
      <div className="p-6 animate-in fade-in duration-500 w-full">
         <div className="mb-6">
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
            Infrastructure & Health
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Administrative maintenance for this instance.
          </p>
        </div>

        {this.loadError && (
          <LoadErrorPanel
            title="Infrastructure settings could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* This card used to be a "Pulse Monitor" asserting Database=Healthy and API Clusters=Online
              with pulsing green dots. Nothing measured either one — the page only loads the
              `maintenance_mode` setting — so both rows were removed rather than left as decoration.
              A real probe belongs here only once something actually polls it. */}
          {this.maintenance !== null && (
            <Card title="Maintenance">
              <SettingRow
                theme={theme}
                icon={FrameworkIcons.Activity}
                title="Maintenance Mode"
                description="Restricts frontend access while you work on the instance."
              >
                <Switch checked={this.maintenance} onChange={this.toggleMaintenance} />
              </SettingRow>
            </Card>
          )}

          {/* `_system_logs` had no retention of any kind, so it grew without bound and a permanent
              WARN stream buried the warnings worth reading. The window is declared HERE and nowhere
              else: blank or 0 keeps everything, and the platform prunes only what this field asks
              for — there is no code-level default quietly deleting an operator's history. */}
          {/* One theme+plugin version set is one server-render "world" resident in the storefront process.
              On a multi-tenant deployment several are live at once — one per distinct set, NOT per site —
              and this is how many stay resident before the least-recently-used is dropped and rebuilt on
              demand. The placeholder is the storefront's own default, stated once in SystemConstants. */}
          <Card title="Server Rendering">
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Layers}
              title="Resident theme worlds"
              stacked
              description="How many distinct theme + plugin sets the storefront keeps loaded at once, each in its own render process; sites on the same set share one. Beyond this, the least recently used is stopped and rebuilt on demand."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper
                    min={1}
                    step={1}
                    value={this.ssrGenerationCap}
                    onChange={this.onSsrCapChange}
                    placeholder={`Default ${SystemConstants.SSR_GENERATION_CAP_DEFAULT}`}
                  />
                </div>
              </div>
            </SettingRow>
            {/* T5b: a theme world is a PROCESS with no secrets in its environment, a heap ceiling and a
                per-render deadline. A theme that leaks or hangs loses its own process, never the storefront. */}
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Database}
              title="Memory ceiling per render process (MB)"
              stacked
              description="A theme world that allocates past this is killed; the storefront answers that request without server rendering and starts a fresh process on the next one."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper min={128} step={64} value={this.ssrRenderMemoryMb} onChange={this.onSsrRenderMemory} placeholder={`Default ${SystemConstants.SSR_RENDER_MEMORY_MB_DEFAULT}`} />
                </div>
              </div>
            </SettingRow>
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Clock}
              title="Deadline per render (ms)"
              stacked
              description="A page render that does not finish within this is abandoned and its process restarted; the page is served for client-side rendering instead."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper min={1000} step={1000} value={this.ssrRenderTimeoutMs} onChange={this.onSsrRenderTimeout} placeholder={`Default ${SystemConstants.SSR_RENDER_TIMEOUT_MS_DEFAULT}`} />
                </div>
                <Button
                  onClick={this.saveSsrCap}
                  isLoading={this.isSavingSsrCap}
                  icon={<FrameworkIcons.Save size={13} />}
                  className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
                >
                  Save
                </Button>
              </div>
            </SettingRow>
          </Card>

          {/* T5: WHERE plugin code runs is an operator decision with a declared default. Isolated = each
              active plugin in its own process with no secrets, tenant-bound calls, a heap ceiling and a
              per-request deadline; shared = inside the api process, as before. A plugin's manifest may
              declare `sandbox: false` (shown as "Shared" on the Plugins page with its reason). */}
          <Card title="Plugin Isolation">
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Shield}
              title="Where plugins run"
              stacked
              description="Isolated: each active plugin runs in its own process — it cannot read the platform's secrets, every database call is bound to the request's site, and it has a memory ceiling and a deadline. Shared: inside the API process. Plugins that declare sandbox: false stay shared either way."
            >
              <Select
                theme={theme}
                value={this.isolationDefault}
                onChange={this.onIsolationDefault}
                placeholder="Default: isolated"
                clearable
                options={[{ value: 'isolated', label: 'Isolated — own process per plugin' }, { value: 'shared', label: 'Shared — inside the API process' }]}
              />
            </SettingRow>
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Database}
              title="Memory ceiling per plugin process (MB)"
              stacked
              description="A plugin that allocates past this is killed and restarted; the API and every other plugin are untouched. A plugin manifest's sandbox.memoryLimit overrides it for that plugin."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper min={64} step={64} value={this.isolationMemoryMb} onChange={this.onIsolationMemory} placeholder={`Default ${SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT}`} />
                </div>
              </div>
            </SettingRow>
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Clock}
              title="Deadline per request (ms)"
              stacked
              description="A plugin route or hook that does not answer within this is failed (504) and its process restarted. A manifest's sandbox.timeout overrides it for that plugin."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper min={1000} step={1000} value={this.isolationTimeoutMs} onChange={this.onIsolationTimeout} placeholder={`Default ${SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT}`} />
                </div>
                <Button onClick={this.saveIsolation} isLoading={this.isSavingIsolation} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
                  Save
                </Button>
              </div>
            </SettingRow>
          </Card>

          <Card title="System Logs">
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Database}
              title="Log Retention"
              stacked
              description="Removes system log entries older than this many days, swept daily. Leave blank to keep every entry forever."
            >
              <div className="flex items-center gap-3">
                <div className="w-full md:w-40">
                  <NumberStepper
                    min={0}
                    step={1}
                    value={this.logRetentionDays}
                    onChange={this.onRetentionChange}
                    placeholder="Keep forever"
                  />
                </div>
                <Button
                  onClick={this.saveRetention}
                  isLoading={this.isSavingRetention}
                  icon={<FrameworkIcons.Save size={13} />}
                  className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
                >
                  Save
                </Button>
              </div>
            </SettingRow>
          </Card>

          {/* The "Danger Zone" card held two buttons — "Flush Cache Clusters" and "Hard Factory
              Reset" — with no onClick, no href and no endpoint behind either. A destructive-looking
              control that silently does nothing is worse than no control: an operator can believe a
              factory reset was queued. Both were removed; re-add them with a real handler and a
              confirmation dialog when the endpoints exist.

              Restart Services below is what that note asked for: a real endpoint
              (`/system/deploy/restart`, permission `system:deploy:restart`, audited), a confirmation
              dialog, and a disabled button with a stated reason wherever the deployment cannot
              honour it. */}
          <div className="lg:col-span-2"><CertificatesSettingsCard /></div>
          <RestartServicesCard />

          {/* Cache flushing and factory reset still have no endpoint and so still have no button. */}
        </div>
      </div>
    );
  }
}
