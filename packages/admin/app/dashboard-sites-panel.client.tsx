import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';

/**
 * One row per site: host, the theme actually serving it, and whether anything broke there today.
 *
 * Hidden on a single-site installation, where a list of one is furniture. Traffic, orders and
 * revenue are deliberately absent: those belong to the plugins that own them, and a site without
 * commerce must show nothing rather than a zero claiming it sold none.
 */
export class DashboardSitesPanel extends AdminComponent {
  private mounted = false;

  @state private sites: Array<Record<string, any>> = [];

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SITES);
      if (this.mounted) this.sites = Array.isArray(data?.sites) ? data.sites : [];
    } catch {
      // Not fatal: the panel stays hidden and the rest of the dashboard renders.
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private stateDot(site: Record<string, any>): string {
    if (Number(site.errors24h || 0) > 0) return 'bg-rose-500';
    // Not published outranks "no theme": a site nobody can reach is the more surprising fact, and it
    // is the one an operator forgets. Amber, not red — it is a state somebody chose, not a fault.
    if (site.visibility && site.visibility !== 'public') return 'bg-amber-500';
    if (!site.themeSlug) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  /** What is WRONG, in the fewest words — or what is serving, when nothing is. */
  private statusText(site: Record<string, any>): string {
    const errors = Number(site.errors24h || 0);
    if (site.visibility === 'private') return 'private — visitors see a holding page';
    if (site.visibility === 'unlisted') return 'unlisted — reachable, not indexed';
    if (errors > 0) return `${errors} ${errors === 1 ? 'error' : 'errors'} today`;
    if (!site.themeSlug) return 'no theme — serves an empty document';
    return site.themeSlug;
  }

  render(): ReactNode {
    if (this.sites.length < 2) return null;

    return (
      <div className="space-y-2">
        <DashboardSectionHeading label="Sites" count={this.sites.length} />
        <div className={`${AdminClass.SURFACE} divide-y divide-slate-200/70 dark:divide-slate-800/70`}>
          {this.sites.map((site) => (
            <div key={String(site.id)} className="flex items-center gap-2.5 px-3 py-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${this.stateDot(site)}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200">
                {String(site.host || site.slug)}
              </span>
              <span className="shrink-0 text-[11px] text-slate-500">{this.statusText(site)}</span>
              {site.state && site.state !== 'active' ? (
                <span className="shrink-0 rounded border border-amber-500/30 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {String(site.state)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
