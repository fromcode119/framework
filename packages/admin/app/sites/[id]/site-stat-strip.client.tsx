import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { SiteRecord } from '@/lib/tenants/site-record';

/**
 * What this site amounts to, at a glance.
 *
 * The same strip the Installed Plugins page uses, for the same reason: these were previously a grey
 * run-on in the page subtitle — "29 members · 10 plugins · vselenskiportal88 · 44 pages" — which is a
 * sentence, not something you can read at a glance. Zero pages is toned as a warning because on a
 * storefront it means every route but the home page answers 404.
 */
export class SiteStatStrip extends PureReactor {
  declare props: Pick<SiteStatStrip, 'site' | 'theme'>;

  @prop declare site: SiteRecord;
  @prop declare theme: ThemeMode;

  private get stats(): Array<{ label: string; value: string | number; tone: string }> {
    const dark = this.theme === ThemeMode.DARK;
    const muted = dark ? 'text-slate-400' : 'text-slate-500';
    const strong = dark ? 'text-white' : 'text-slate-900';
    const site = this.site;

    const stats: Array<{ label: string; value: string | number; tone: string }> = [
      { label: 'State', value: site.isActive ? 'Active' : site.state, tone: site.isActive ? 'text-emerald-500' : 'text-amber-500' },
      { label: 'Members', value: site.memberCount, tone: strong },
      { label: 'Plugins', value: site.plugins.length, tone: strong },
    ];
    if (site.isWorkspace) {
      stats.push({ label: 'Appearance', value: site.appearance || 'none', tone: site.appearance ? strong : muted });
    } else {
      stats.push({ label: 'Theme', value: site.theme ?? 'none', tone: site.theme ? strong : 'text-amber-500' });
      stats.push({ label: 'Pages', value: site.pageCount, tone: site.pageCount ? strong : 'text-amber-500' });
    }
    return stats;
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {this.stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 ${dark ? 'border-white/10 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}
          >
            <span className={`text-sm font-bold tabular-nums ${stat.tone}`}>{stat.value}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }
}
