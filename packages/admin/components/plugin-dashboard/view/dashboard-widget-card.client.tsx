import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { SectionCard } from '@/components/plugin-dashboard/view/section-card.client';
import { DashboardWidgetDataCache } from '@/components/plugin-dashboard/view/dashboard-widget-data-cache';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The card a plugin's dashboard widget renders: its title, a link to the screen it summarises, and its
 * data once loaded — with a spinner while loading and a stated failure if the load fails, never an empty
 * card that would read as "nothing here".
 *
 *   <DashboardWidgetCard title={t('…')} icon={<Inbox size={16} />} href={route}
 *     cacheKey="acme.orders" load={() => api.getOrders()} renderData={(orders) => …} />
 *
 * Widgets over the same figures pass the same `cacheKey` and share one load (see DashboardWidgetDataCache).
 */
export class DashboardWidgetCard extends Reactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare icon?: ReactNode;
  /** The screen this widget summarises; shown as the card's "Open" link. */
  @prop declare href?: string;
  /** Optional link text in place of "Open". */
  @prop declare linkLabel?: string;
  @prop declare load: () => Promise<unknown>;
  @prop declare renderData: (data: any) => ReactNode; // eslint-disable-line @typescript-eslint/no-explicit-any
  @prop declare cacheKey?: string;
  /** How long a shared load is reused, in milliseconds (default 30s). */
  @prop declare cacheMs?: number;
  /** Render the body edge to edge, for lists that draw their own rows. */
  @prop declare noPadding?: boolean;

  @state private data: unknown = undefined;
  @state private loaded = false;
  @state private failed = false;

  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    const load = this.cacheKey ? DashboardWidgetDataCache.load(this.cacheKey, this.cacheMs ?? 30_000, this.load) : this.load();
    load
      .then((data) => { if (this.mounted) { this.data = data; this.loaded = true; } })
      .catch(() => { if (this.mounted) this.failed = true; });
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactNode {
    const link = this.href ? (
      <a href={this.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
        {this.linkLabel || AdminI18n.t('dashboard.widgets.open')} <FrameworkIcons.ArrowRight size={13} />
      </a>
    ) : undefined;
    return (
      <SectionCard title={this.title} subtitle={this.subtitle} icon={this.icon} actions={link} noPadding={this.noPadding}>
        {this.renderBody()}
      </SectionCard>
    );
  }

  private renderBody(): ReactNode {
    if (this.failed) return <p className="px-4 py-6 text-center text-[12px] text-rose-600">{AdminI18n.t('dashboard.widgets.loadFailed')}</p>;
    if (!this.loaded) {
      return <div className="flex h-24 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
    }
    return this.renderData(this.data);
  }
}
