import type { ReactNode } from 'react';
import { Reactor, bound, prop, state, watch } from '@fromcode119/react-class-components';
import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { RecordsHubOpenItem } from '@/lib/records-hub-open-item';
import type { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';
import { RecordPartActions } from '@/components/collection/edit/view/record-part-actions.client';
import { RecordPartRow } from '@/components/collection/edit/view/record-part-row.client';

/**
 * What other plugins hold about this record, drawn INSIDE the section it belongs to.
 *
 * A payment is part of how an order was paid and a shipment is part of how it is delivered; listed in a
 * panel of their own at the foot of the page they read as five separate things. The collection says
 * which of its sections each part belongs in, the provider says which part its records are, and neither
 * names the other. A part with nothing yet says so in the collection's own words.
 */
export class CollectionRecordPart extends Reactor {
  @prop declare links: CollectionRecordLinksDeclaration;
  @prop declare sectionKey: string;
  @prop declare navigate?: (href: string) => void;

  @state private items: IRecordsHubItem[] | null = null;
  @state private actions: Array<{ id: string; label: string; href: string; icon?: string; part?: string }> = [];

  private alive = false;

  componentDidMount(): void {
    this.alive = true;
    this.onUnmount(() => { this.alive = false; });
    void this.fetchItems();
  }

  @watch('links')
  protected onLinksChanged(next: CollectionRecordLinksDeclaration, prev: CollectionRecordLinksDeclaration): void {
    if (next?.reloadKey !== prev?.reloadKey) void this.fetchItems();
  }

  private async fetchItems(): Promise<void> {
    try {
      const result = await AdminApi.get(this.links.url);
      if (!this.alive) return;
      this.actions = Array.isArray(result?.actions) ? result.actions : [];
      this.items = Array.isArray(result?.items) ? result.items : [];
    } catch {
      // The linked-records list reports a failed load; a section stays as its own fields.
      if (this.alive) this.items = [];
    }
  }

  @bound private open(item: IRecordsHubItem): void { RecordsHubOpenItem.open(item, this.navigate); }
  @bound private follow(href: string): void { RecordsHubOpenItem.open({ href } as IRecordsHubItem, this.navigate); }
  @bound private download(item: IRecordsHubItem): void { void RecordsHubOpenItem.download(item, this.navigate); }

  private groupsOf(term: string): Array<{ group: string; items: IRecordsHubItem[] }> {
    const groups: Array<{ group: string; items: IRecordsHubItem[] }> = [];
    for (const item of this.items || []) {
      if (item.part !== term) continue;
      const existing = groups.find((entry) => entry.group === item.group);
      if (existing) existing.items.push(item); else groups.push({ group: item.group, items: [item] });
    }
    return groups;
  }

  private renderPart(part: { term: string; empty: string }): ReactNode {
    const groups = this.groupsOf(part.term);
    const actions = this.actions.filter((action) => action.part === part.term);
    if (!groups.length && !actions.length && !part.empty) return null;
    return (
      <div key={part.term} className="fc-record-part__term">
        {!groups.length && part.empty ? <p className="fc-record-part__empty">{part.empty}</p> : null}
        {groups.map((entry) => (
          <div key={entry.group} className="fc-record-part__group">
            <h3 className="fc-record-part__heading">{entry.group}</h3>
            {entry.items.map((item) => <RecordPartRow key={`${item.kind}:${item.id}`} item={item} onOpen={this.open} onDownload={this.download} />)}
          </div>
        ))}
        <RecordPartActions actions={actions} onOpen={this.follow} />
      </div>
    );
  }

  render(): ReactNode {
    const parts = this.links.partsOf(this.sectionKey);
    // Until the answer is in there is nothing true to say: "none yet" would be a guess.
    if (!parts.length || this.items === null) return null;
    const drawn = parts.map((part) => this.renderPart(part)).filter(Boolean);
    return drawn.length ? <div className="fc-record-part">{drawn}</div> : null;
  }
}
