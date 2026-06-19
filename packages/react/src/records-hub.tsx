"use client";

import React from 'react';
import * as Lucide from 'lucide-react';
import type {
  RecordsHubItem,
  RecordsHubGroup,
  RecordsHubProps,
  RecordsHubState,
} from './records-hub.interfaces';

/**
 * Grouped, newest-first timeline of every record a person owns across plugins.
 * Presentation-only — the host supplies `load()` (authed fetch) and `onOpenItem`.
 * Reused on the Person 360 page and embedded in plugin record detail views.
 */
export class RecordsHub extends React.Component<RecordsHubProps, RecordsHubState> {
  private mounted = false;

  state: RecordsHubState = {
    loading: true,
    error: '',
    groups: [],
    total: 0,
    activeGroup: 'all',
    errors: [],
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentDidUpdate(prev: RecordsHubProps): void {
    if (prev.reloadKey !== this.props.reloadKey) {
      void this.load();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    this.setState({ loading: true, error: '' });
    try {
      const result = await this.props.load();
      if (!this.mounted) return;
      const groups = this.toGroups(result);
      const total = groups.reduce((sum, g) => sum + g.items.length, 0);
      this.setState({ loading: false, groups, total, errors: result?.errors || [] });
    } catch (err: any) {
      if (this.mounted) {
        this.setState({ loading: false, error: String(err?.message || 'Failed to load records') });
      }
    }
  }

  private toGroups(result: any): RecordsHubGroup[] {
    if (Array.isArray(result?.groups) && result.groups.length) return result.groups;
    const items: RecordsHubItem[] = Array.isArray(result?.items) ? result.items : [];
    const order: string[] = [];
    const buckets = new Map<string, RecordsHubItem[]>();
    for (const item of items) {
      const key = String(item?.group || 'Other');
      if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
      buckets.get(key)!.push(item);
    }
    return order.map((group) => ({ group, items: buckets.get(group)! }));
  }

  private icon(name?: string): React.ComponentType<any> {
    const fallback = Lucide.FileText;
    if (!name) return fallback;
    return ((Lucide as any)[name] as React.ComponentType<any>) || fallback;
  }

  // The framework is domain-agnostic: it has NO money concept. It renders the provider's
  // opaque `trailing` label verbatim — the owning plugin decides what it means.
  private trailing(item: RecordsHubItem): string | null {
    const display = item.trailing == null ? '' : String(item.trailing).trim();
    return display || null;
  }

  private date(value?: string): string {
    if (!value) return '';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms).toISOString().slice(0, 10);
  }

  private isDark(): boolean {
    return this.props.theme === 'dark';
  }

  private renderItem(item: RecordsHubItem): React.ReactNode {
    const dark = this.isDark();
    const Icon = this.icon(item.icon);
    const trailing = this.trailing(item);
    const date = this.date(item.date);
    const openable = Boolean(item.href || item.downloadUrl);
    return (
      <div key={`${item.kind}:${item.id}`}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${dark ? 'border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/60' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-[13px] font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{item.title}</p>
            {item.status ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
            ) : null}
            {(item.badges || []).map((b) => (
              <span key={b} className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{b}</span>
            ))}
          </div>
          {item.subtitle ? <p className="truncate text-[11px] font-semibold text-slate-400 mt-0.5">{item.subtitle}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          {trailing ? <p className={`text-[12px] font-bold tabular-nums ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{trailing}</p> : null}
          {date ? <p className="text-[10px] font-bold text-slate-400 tabular-nums">{date}</p> : null}
        </div>
        {openable ? (
          <button type="button" onClick={() => this.props.onOpenItem?.(item)}
            className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
            aria-label={item.downloadUrl ? 'Download' : 'Open'}>
            {item.downloadUrl ? <Lucide.Download size={15} /> : <Lucide.ExternalLink size={15} />}
          </button>
        ) : null}
      </div>
    );
  }

  private renderGroup(group: RecordsHubGroup): React.ReactNode {
    const dark = this.isDark();
    return (
      <div key={group.group} className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h4 className={`text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{group.group}</h4>
          <span className="text-[11px] font-bold text-slate-400">{group.items.length}</span>
        </div>
        <div className="space-y-1.5">{group.items.map((item) => this.renderItem(item))}</div>
      </div>
    );
  }

  render(): React.ReactNode {
    const dark = this.isDark();
    const { loading, error, groups, total, activeGroup, errors } = this.state;
    const title = this.props.title || 'Records';
    const visible = activeGroup === 'all' ? groups : groups.filter((g) => g.group === activeGroup);

    return (
      <div className={`rounded-3xl border p-6 ${dark ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lucide.FolderOpen size={16} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />
            <h3 className={`text-[13px] font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
            <span className="text-[11px] font-bold text-slate-400">{total}</span>
          </div>
          {!loading && groups.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {['all', ...groups.map((g) => g.group)].map((key) => (
                <button key={key} type="button" onClick={() => this.setState({ activeGroup: key })}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${activeGroup === key
                    ? (dark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                    : (dark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>
                  {key === 'all' ? 'All' : key}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-[12px] font-bold">
            <Lucide.Loader2 size={16} className="animate-spin" /> Loading records…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 text-rose-700 px-4 py-3 text-[12px] font-bold dark:bg-rose-500/10">{error}</div>
        ) : total === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-center">
            <Lucide.Inbox size={28} className="text-slate-300" />
            <p className="text-[12px] font-bold text-slate-400">{this.props.emptyHint || 'No records yet for this person.'}</p>
          </div>
        ) : (
          <div className="space-y-5">{visible.map((group) => this.renderGroup(group))}</div>
        )}

        {errors.length ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10">
            <Lucide.AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>Some sources could not be loaded: {errors.map((e) => e.provider).join(', ')}</span>
          </div>
        ) : null}
      </div>
    );
  }
}
