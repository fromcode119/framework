import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
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

  render() {
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
               <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-semibold tracking-wide text-indigo-500`}>Maintenance Mode</span>
                      <p className="text-[10px] text-slate-400 font-medium">Restricts frontend access.</p>
                    </div>
                    <Switch checked={this.maintenance} onChange={this.toggleMaintenance} />
                  </div>
               </div>
            </Card>
          )}

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
