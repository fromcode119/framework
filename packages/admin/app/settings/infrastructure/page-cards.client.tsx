import { SystemConstants } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { Explanation } from '@/components/ui/view/explanation.client';
import { Select } from '@/components/ui/view/select.client';
import { InfrastructureSettingsPageActions } from '@/app/settings/infrastructure/page-actions.client';
import { PluginIsolationMode } from '@fromcode119/core/client';

/**
 * The four cards this screen is made of.
 *
 * One method each, because they are four independent settings groups with four independent saves —
 * and because a card that has nothing to say yet returns `null` rather than rendering an empty
 * control that states something the platform has not confirmed.
 */
export abstract class InfrastructureSettingsPageCards extends InfrastructureSettingsPageActions {
  /**
   * Maintenance mode — the one switch that takes the whole deployment offline.
   *
   * This card used to be a "Pulse Monitor" asserting Database=Healthy and API Clusters=Online with
   * pulsing green dots. Nothing measured either one — the page only loads the `maintenance_mode`
   * setting — so both rows were removed rather than left as decoration. A real probe belongs here
   * only once something actually polls it.
   *
   * Nothing is rendered until the setting has loaded: an unchecked switch would state the
   * deployment is live before anything has asked.
   */
  protected maintenanceCard(): ReactNode {
    if (this.maintenance === null) return null;
    const theme = this.theme;
    return (
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
    );
  }

  /**
   * How much of the box a theme world may take, and how many stay resident.
   *
   * One theme+plugin version set is one server-render "world" resident in the storefront process.
   * On a multi-tenant deployment several are live at once — one per distinct set, NOT per site — and
   * the cap is how many stay resident before the least recently used is dropped and rebuilt on
   * demand. Each placeholder is the storefront's own default, stated once in SystemConstants.
   *
   * T5b: a theme world is a PROCESS with no secrets in its environment, a heap ceiling and a
   * per-render deadline. A theme that leaks or hangs loses its own process, never the storefront.
   */
  protected serverRenderingCard(): ReactNode {
    const theme = this.theme;
    return (
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
    );
  }

  /**
   * WHERE plugin code runs, and what it may spend there.
   *
   * T5: an operator decision with a declared default. Isolated = each active plugin in its own
   * process with no secrets, tenant-bound calls, a heap ceiling and a per-request deadline; shared =
   * inside the api process, as before. A plugin's manifest may declare `sandbox: false` (shown as
   * "Shared" on the Plugins page, with its reason).
   */
  protected pluginIsolationCard(): ReactNode {
    const theme = this.theme;
    return (
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
              options={[{ value: String(PluginIsolationMode.ISOLATED.value), label: 'Isolated — own process per plugin' }, { value: String(PluginIsolationMode.SHARED.value), label: 'Shared — inside the API process' }]}
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
    );
  }

  /**
   * How long the system log and the audit journal are kept.
   *
   * `_system_logs` had no retention of any kind, so it grew without bound and a permanent WARN
   * stream buried the warnings worth reading. The window is declared HERE and nowhere else: blank or
   * 0 keeps everything, and the platform prunes only what this field asks for — there is no
   * code-level default quietly deleting an operator's history.
   */
  protected retentionCard(): ReactNode {
    const theme = this.theme;
    return (
        <Card title="Retention">
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Database}
            title="Log Retention"
            stacked
            description="Days of system-log history to keep across the whole deployment, swept daily. Blank keeps every entry forever."
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

          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Shield}
            title="Audit Retention"
            stacked
            description="Days of audit history to keep across the whole deployment, swept daily. Blank keeps every entry forever."
            explanation={(
              <Explanation>
                <p>
                  This is not the log above. It removes the <strong>audit trail</strong> — security denials,
                  settings changes, MCP tool calls and AI invocations — for every site on this platform.
                </p>
                <p>
                  <strong>Minimum 180 days.</strong> This journal is this platform&rsquo;s EU AI Act Art. 12
                  record, which is expected to survive six months; a shorter window is refused rather than
                  quietly shortened. Blank — keep forever — is always allowed.
                </p>
                <p>Each prune is itself written to the audit trail, with how many rows went and whose.</p>
              </Explanation>
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-full md:w-40">
                <NumberStepper
                  min={0}
                  step={1}
                  value={this.auditRetentionDays}
                  onChange={this.onAuditRetentionChange}
                  placeholder="Keep forever"
                />
              </div>
              <Button
                onClick={this.saveAuditRetention}
                isLoading={this.isSavingAuditRetention}
                icon={<FrameworkIcons.Save size={13} />}
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                Save
              </Button>
            </div>
          </SettingRow>
        </Card>
    );
  }
}
