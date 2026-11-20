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
import { ViewTranslations } from '@react/view/view-translations';

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
  @prop declare onDownloadItem?: (item: IRecordsHubItem) => void;
  /** No longer read: the hub draws in the console's colours, which follow its light/dark mode by
      themselves. Still accepted, because plugin pages pass it. */
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
      this.error = String(err?.message || ViewTranslations.t('view.recordsHub.loadFailed'));
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

  /** Resolves an icon name to a component (FileText for unknown names); icons resolve lazily at render time. */
  private icon(name: string): ComponentType<any> {
    return FrameworkIcons.getIcon(LucideLazyLoader.has(name) ? name : 'FileText');
  }

  render(): ReactNode {
    const IconInbox = this.icon('Inbox');
    const IconAlertTriangle = this.icon('AlertTriangle');
    const { loading, error, groups, total, activeGroup, errors } = this;
    const title = this.title || 'Records';
    const visible = activeGroup === 'all' ? groups : groups.filter((g) => g.group === activeGroup);

    // The console's own card: its head (name, count, what narrows it), then its body. The classes are the
    // console's — this package draws no colours of its own, so the card follows the console's scheme.
    return (
      <div className="fc-surface fc-record-card">
        <div className="fc-record-card__head">
          <h2 className="fc-record-card__title">
            {title}
            <span className="fc-record-card__count">{total}</span>
          </h2>
          {!loading && groups.length > 1 ? (
            <div className="fc-record-card__aside">
              <div className="fc-tabs" role="tablist">
                {['all', ...groups.map((g) => g.group)].map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={activeGroup === key} className={`fc-tab${activeGroup === key ? ' fc-tab--on' : ''}`} onClick={() => { this.activeGroup = key; }}>
                    {key === 'all' ? ViewTranslations.t('view.recordsHub.all') : key}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="fc-record-card__body">
          {loading ? (
            <div className="fc-loader" role="status"><span className="fc-loader__ring" aria-hidden="true" /><span className="fc-loader__label">{ViewTranslations.t('view.recordsHub.loading')}</span></div>
          ) : error ? (
            <div className="fc-alert" data-tone="danger" role="alert"><p className="fc-alert__text">{error}</p></div>
          ) : total === 0 ? (
            <div className="fc-empty fc-empty--inline">
              <span className="fc-empty__icon"><IconInbox size={16} /></span>
              <span className="fc-empty__text"><span className="fc-empty__title">{this.emptyHint || ViewTranslations.t('view.recordsHub.empty')}</span></span>
            </div>
          ) : (
            <div className="fc-stack">{visible.map((group) => <RecordsHubGroupSection key={group.group} group={group} onOpenItem={this.onOpenItem} onDownloadItem={this.onDownloadItem} />)}</div>
          )}
          {errors.length ? (
            <div className="fc-alert" data-tone="warning" role="status">
              <span className="fc-alert__icon" aria-hidden="true"><IconAlertTriangle size={15} /></span>
              <p className="fc-alert__text">{ViewTranslations.t('view.recordsHub.partial', undefined, { providers: errors.map((e) => e.provider).join(', ') })}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
