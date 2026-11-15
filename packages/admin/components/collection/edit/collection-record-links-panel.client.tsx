import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { Reactor, bound, prop, state, watch } from '@fromcode119/react-class-components';
import type { IRecordsHubItem } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { RecordPartRow } from '@/components/collection/edit/view/record-part-row.client';
import { AdminApi } from '@/lib/api';
import { RecordsHubOpenItem } from '@/lib/records-hub-open-item';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RecordPartActions } from '@/components/collection/edit/view/record-part-actions.client';
import type { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';

/**
 * "What else relates to this record?" — the list an order, a client or a subscription gets once its
 * collection declares `admin.recordLinks`.
 *
 * The admin knows nothing about what it is showing. It reads the correlation keys the collection
 * declared, takes their values off the record in front of it, and asks the framework; whichever plugins
 * said they understand one of those key names answer.
 *
 * It lists only what has no section of its own on this page. Records whose part the collection mapped
 * to a section on screen are drawn there, as part of the record; once every linked record has such a
 * place this list has nothing left to say and is not drawn.
 *
 * It draws those records with the SAME row as the placed ones (`RecordPartRow`). It used to draw them
 * with a component of its own, so one record page carried two looks for the same thing: the order and
 * the invoice as plain lines in their card, the shipment as a bordered tile under a heading in a panel
 * below — the difference the operator sees and nobody can explain.
 */
export class CollectionRecordLinksPanel extends Reactor {
  @prop declare links: CollectionRecordLinksDeclaration;
  /** Part terms already drawn inside a section of the record. */
  @prop declare placedTerms: string[];
  @prop declare theme: ThemeMode;
  @prop declare navigate?: (href: string) => void;

  @state private result: { items: IRecordsHubItem[]; errors: any[]; actions: any[] } | null = null;
  @state private failed = false;

  private alive = false;

  componentDidMount(): void {
    this.alive = true;
    this.onUnmount(() => { this.alive = false; });
    void this.fetchResult();
    // Back from a page that added a record here (an invoice made from this order) restores this page
    // from the browser's memory as it was; read the links again so what was just made is on it.
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) void this.fetchResult(); };
    window.addEventListener('pageshow', onShow);
    this.onUnmount(() => window.removeEventListener('pageshow', onShow));
  }

  @watch('links')
  protected onLinksChanged(next: CollectionRecordLinksDeclaration, prev: CollectionRecordLinksDeclaration): void {
    if (next?.reloadKey !== prev?.reloadKey) void this.fetchResult();
  }

  private async fetchResult(): Promise<void> {
    try {
      const result = await AdminApi.get(this.links.url);
      if (!this.alive) return;
      this.failed = false;
      this.result = { items: Array.isArray(result?.items) ? result.items : [], errors: result?.errors || [], actions: Array.isArray(result?.actions) ? result.actions : [] };
    } catch {
      if (this.alive) this.failed = true;
    }
  }

  private get remaining(): IRecordsHubItem[] {
    return (this.result?.items || []).filter((item) => !item.part || !this.placedTerms.includes(this.links.termOf(item.part)));
  }

  /** The leftover records, by the group their provider gave them. */
  private get groups(): Array<{ group: string; items: IRecordsHubItem[] }> {
    const groups: Array<{ group: string; items: IRecordsHubItem[] }> = [];
    for (const item of this.remaining) {
      const group = String(item.group || '');
      const existing = groups.find((entry) => entry.group === group);
      if (existing) existing.items.push(item); else groups.push({ group, items: [item] });
    }
    return groups;
  }

  @bound private open(item: IRecordsHubItem): void { RecordsHubOpenItem.open(item, this.navigate); }
  @bound private download(item: IRecordsHubItem): void { void RecordsHubOpenItem.download(item, this.navigate); }

  render(): ReactNode {
    if (!this.result && !this.failed) return null;
    const remaining = this.remaining;
    const errors = this.result?.errors || [];
    const actions = (this.result?.actions || []).filter((action: any) => !action.part || !this.placedTerms.includes(this.links.termOf(action.part)));
    // Everything linked has a section of its own on this page, and nothing went wrong finding it.
    if (!this.failed && this.placedTerms.length > 0 && !remaining.length && !errors.length && !actions.length) return null;
    const title = this.links.title || AdminI18n.t('collection.edit.relatedRecords');
    return (
      <Card title={title}>
        <div className="fc-record-part">
          {this.failed || errors.length ? (
            <p className="fc-record-part__empty-text">{AdminI18n.t('collection.edit.relatedFailed')}</p>
          ) : null}
          {!this.failed && !remaining.length && !errors.length ? (
            <p className="fc-record-part__empty-text">{this.links.emptyHint || AdminI18n.t('collection.edit.relatedEmpty')}</p>
          ) : null}
          {this.groups.map((entry) => (
            <div key={entry.group} className="fc-record-part__group">
              {entry.group ? <span className="fc-record-part__heading">{entry.group}</span> : null}
              <div className="fc-record-part__items">
                {entry.items.map((item) => (
                  <RecordPartRow key={`${item.kind}:${item.id}`} item={item} onOpen={this.open} onDownload={this.download} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <RecordPartActions actions={actions} onOpen={(href: string) => RecordsHubOpenItem.open({ href } as IRecordsHubItem, this.navigate)} />
      </Card>
    );
  }
}
