import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { ByteSizeFormatter } from '@/lib/byte-size-formatter';
import { DashboardSystemMeter } from '@/app/dashboard-system-meter.client';
import { DashboardScheduleList } from '@/app/dashboard-schedule-list.client';

/**
 * What the machine is doing, and what the scheduler will do next.
 *
 * Both halves are MEASURED reads — `/admin/stats/host` calls `os`/`statfs`, `/admin/stats/schedule`
 * reads the scheduler's own table. A figure the platform could not obtain renders as "unknown"
 * rather than zero, because a disk that cannot be stat'd and an empty disk are not the same thing.
 */
export class DashboardSystemPanel extends AdminComponent {
  private mounted = false;

  @state private host: Record<string, any> | null = null;
  @state private schedule: Record<string, any> | null = null;
  @state private failed = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const [host, schedule] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.HOST),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SCHEDULE),
      ]);
      if (!this.mounted) return;
      this.host = host;
      this.schedule = schedule;
    } catch {
      // Not fatal to the dashboard: the panel says it could not read, and the rest of the page stands.
      if (this.mounted) this.failed = true;
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get memory(): { used: number; total: number } | null {
    const memory = this.host?.memory;
    if (!memory?.totalBytes) return null;
    return { used: Number(memory.usedBytes || 0), total: Number(memory.totalBytes) };
  }

  private get disk(): { used: number; total: number } | null {
    const disk = this.host?.disk;
    if (!disk?.totalBytes) return null;
    return { used: Number(disk.usedBytes || 0), total: Number(disk.totalBytes) };
  }

  /**
   * Load average divided by cores, which is the only form of it a reader can judge: 1.0 means the
   * machine is exactly busy, above that means work is queueing. Null when the OS supplies none.
   */
  private get cpuPressure(): number | null {
    const cores = Number(this.host?.cpu?.cores || 0);
    const load = this.host?.cpu?.load1;
    if (!cores || load === null || load === undefined) return null;
    return Number(load) / cores;
  }

  private get processLine(): string {
    const rss = Number(this.host?.memory?.processResidentBytes || 0);
    const nodeVersion = String(this.host?.process?.nodeVersion || '');
    return [rss ? `${ByteSizeFormatter.format(rss)} in this process` : '', nodeVersion ? `Node ${nodeVersion}` : '']
      .filter((part) => part !== '')
      .join(' · ');
  }

  render(): ReactNode {
    if (this.failed) {
      return (
        <div className={`p-3 ${AdminClass.SURFACE}`}>
          <p className="text-[11px] text-slate-500">System metrics could not be read.</p>
        </div>
      );
    }

    if (!this.host) {
      return <div className={`h-[132px] ${AdminClass.SURFACE} animate-pulse`} />;
    }

    return (
      <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            {String(this.host?.host?.hostname || 'This machine')}
          </span>
          <span className="text-[10px] text-slate-400">{this.processLine}</span>
        </div>

        <div className="px-3 py-2 space-y-2">
          <DashboardSystemMeter label="Memory" used={this.memory?.used ?? null} total={this.memory?.total ?? null} />
          <DashboardSystemMeter label="Disk" used={this.disk?.used ?? null} total={this.disk?.total ?? null} />
          <DashboardSystemMeter
            label={`CPU · ${Number(this.host?.cpu?.cores || 0)} cores`}
            ratio={this.cpuPressure}
            caption={this.cpuPressure === null ? 'not reported' : `load ${this.host?.cpu?.load1}`}
          />
        </div>

        <DashboardScheduleList schedule={this.schedule} />
      </div>
    );
  }
}
