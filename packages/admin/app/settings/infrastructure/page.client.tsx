import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';

export class InfrastructureSettingsPage extends AdminComponent {
  @state isLoading = true;
  @state maintenance = false;

  async componentDidMount() {
    try {
      const response = await AdminSystemSettingsClient.getAll();
      this.maintenance = response?.maintenance_mode === true || response?.maintenance_mode === 'true';
    } finally {
      this.isLoading = false;
    }
  }

  @bound
  async toggleMaintenance(val: boolean) {
    const addNotification = this.runtime.notify.addNotification;
    this.maintenance = val;
    try {
      await AdminSystemSettingsClient.update({ maintenance_mode: val });
      addNotification({ title: 'System Updated', message: `Maintenance mode is now ${val ? 'active' : 'inactive'}.`, type: NotificationType.INFO });
    } catch {
      addNotification({ title: 'Error', message: 'Failed to toggle mode.', type: NotificationType.ERROR });
    }
  }

  render() {
    const theme = this.theme;

    if (this.isLoading) return <div className="p-12"><Loader label="Analyzing Cluster Health..." /></div>;

    return (
      <div className="p-6 animate-in fade-in duration-500 w-full">
         <div className="mb-6">
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
            Infrastructure & Health
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Monitor system clusters and perform administrative maintenance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card title="Pulse Monitor">
             <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold tracking-wide ${theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-500'}`}>Database</span>
                  <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    Healthy
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold tracking-wide ${theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-500'}`}>API Clusters</span>
                  <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <span className={`text-xs font-semibold tracking-wide text-indigo-500`}>Maintenance Mode</span>
                    <p className="text-[10px] text-slate-400 font-medium">Restricts frontend access.</p>
                  </div>
                  <Switch checked={this.maintenance} onChange={this.toggleMaintenance} />
                </div>
             </div>
          </Card>

          <Card title="Danger Zone">
             <div className="space-y-4 py-4">
                <Button variant={ButtonVariant.GHOST} className="w-full justify-between group border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl px-6 py-4" icon={<FrameworkIcons.Database size={18} />}>
                  Flush Cache Clusters
                  <FrameworkIcons.ArrowRight size={16} className="opacity-40 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant={ButtonVariant.GHOST} className="w-full justify-between group bg-rose-50 border border-rose-100 text-rose-600 rounded-xl px-6 py-4 dark:bg-rose-500/10 dark:border-rose-500/20" icon={<FrameworkIcons.Shield size={18} />}>
                  Hard Factory Reset
                  <FrameworkIcons.ArrowRight size={16} className="opacity-40 group-hover:translate-x-1 transition-transform" />
                </Button>
             </div>
          </Card>
        </div>
      </div>
    );
  }
}
