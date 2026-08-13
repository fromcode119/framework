import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';

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
  @state isSavingRetention = false;

  async componentDidMount() {
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

  render(): ReactNode {
    const theme = this.theme;

    if (this.isLoading) return <div className="p-12"><Loader label="Loading infrastructure settings..." /></div>;

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
          <Card title="System Logs">
            <SettingRow
              theme={theme}
              icon={FrameworkIcons.Database}
              title="Log Retention"
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
              confirmation dialog when the endpoints exist. */}
        </div>
      </div>
    );
  }
}
