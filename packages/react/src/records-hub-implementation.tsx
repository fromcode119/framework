import { ThemeMode } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop, state, watch } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@react/icons/view/framework-icons.client';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';
import type { IRecordsHubResult } from '@react/interfaces/records-hub-result.interface';
import { RecordsHub } from '@react/records-hub';
import { RecordsHubGroupSection } from '@react/records-hub-group-section';

/**
 * The surface `RecordsHub` renders inside its boundary: a grouped, newest-first timeline of every record
 * a person owns across plugins. Presentation-only — the host supplies `load()` (authed fetch) and
 * `onOpenItem`. Reused on the Person 360 page and embedded in plugin record detail views.
 *
 * Registers itself as the boundary's default on evaluation (static initialiser below); the browser bridge
 * swaps in a `React.lazy` of this module so it stays out of the storefront's first chunk.
 */
export class RecordsHubImplementation extends Reactor {
  protected static readonly registeredAsDefault = RecordsHub.implementation.provideDefault(RecordsHubImplementation);

  /** Fetch the aggregated records (host owns auth). */
  @prop declare load: () => Promise<IRecordsHubResult>;
  /** Host handler for opening/downloading an item (href nav or authed download). */
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;
  @prop declare theme?: ThemeMode | string;
  @prop declare title?: string;
  @prop declare emptyHint?: string;
  /** Re-run the fetch when this value changes (e.g. the person/route id). */
  @prop declare reloadKey?: string | number;

  @state private loading = true;
  @state private error = '';
  @state private groups: IRecordsHubGroup[] = [];
  @state private total = 0;
  @state private activeGroup = 'all';
  @state private errors: Array<{ provider: string; message: string }> = [];

  /** Guards the async fetch from assigning state after unmount. */
  private alive = false;

  componentDidMount(): void {
    this.alive = true;
    this.onUnmount(() => { this.alive = false; });
    void this.fetchRecords();
  }

  /** Replaces `componentDidUpdate` + a prevProps comparison. */
  @watch('reloadKey')
  protected onReloadKeyChanged(): void {
    void this.fetchRecords();
  }

  /** NOT named `load` — that is the render-prop this component receives. */
  private async fetchRecords(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.load();
      if (!this.alive) return;
      const groups = this.toGroups(result);
      this.groups = groups;
      this.total = groups.reduce((sum, g) => sum + g.items.length, 0);
      this.errors = result?.errors || [];
      this.loading = false;
    } catch (err: any) {
      if (!this.alive) return;
      this.error = String(err?.message || 'Failed to load records');
      this.loading = false;
    }
  }

  private toGroups(result: any): IRecordsHubGroup[] {
    if (Array.isArray(result?.groups) && result.groups.length) return result.groups;
    const items: IRecordsHubItem[] = Array.isArray(result?.items) ? result.items : [];
    const order: string[] = [];
    const buckets = new Map<string, IRecordsHubItem[]>();
    for (const item of items) {
      const key = String(item?.group || 'Other');
      if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
      buckets.get(key)!.push(item);
    }
    return order.map((group) => ({ group, items: buckets.get(group)! }));
  }


  private isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }



  /** Resolves an icon name to a component (FileText for unknown names); icons resolve lazily at render time. */
  private icon(name: string): ComponentType<any> {
    return FrameworkIcons.getIcon(LucideLazyLoader.has(name) ? name : 'FileText');
  }

  render(): ReactNode {
    const dark = this.isDark();
    const IconFolderOpen = this.icon('FolderOpen');
    const IconLoader = this.icon('Loader2');
    const IconInbox = this.icon('Inbox');
    const IconAlertTriangle = this.icon('AlertTriangle');
    const { loading, error, groups, total, activeGroup, errors } = this;
    const title = this.title || 'Records';
    const visible = activeGroup === 'all' ? groups : groups.filter((g) => g.group === activeGroup);

    return (
      <div className={`rounded-3xl border p-6 ${dark ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconFolderOpen size={16} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />
            <h3 className={`text-[13px] font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
            <span className="text-[11px] font-bold text-slate-400">{total}</span>
          </div>
          {!loading && groups.length > 1 ? (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {['all', ...groups.map((g) => g.group)].map((key) => (
                <button key={key} type="button" onClick={() => { this.activeGroup = key; }}
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
            <IconLoader size={16} className="animate-spin" /> Loading records…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 text-rose-700 px-4 py-3 text-[12px] font-bold dark:bg-rose-500/10">{error}</div>
        ) : total === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-center">
            <IconInbox size={28} className="text-slate-300" />
            <p className="text-[12px] font-bold text-slate-400">{this.emptyHint || 'No records yet for this person.'}</p>
          </div>
        ) : (
          <div className="space-y-5">{visible.map((group) => <RecordsHubGroupSection key={group.group} group={group} dark={dark} onOpenItem={this.onOpenItem} />)}</div>
        )}

        {errors.length ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10">
            <IconAlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>Some sources could not be loaded: {errors.map((e) => e.provider).join(', ')}</span>
          </div>
        ) : null}
      </div>
    );
  }
}
