import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Reactor, bound, prop, state, watch } from '@fromcode119/react-class-components';
import type { IRecordsHubItem } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RecordsHubOpenItem } from '@/lib/records-hub-open-item';
import { MenuAction } from '@/components/ui/view/menu-action.client';
import type { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';
import { RecordPartPlace } from '@/components/collection/edit/enums/record-part-place.enum';
import { RecordPartRow } from '@/components/collection/edit/view/record-part-row.client';
import { RecordPartSource } from '@/components/collection/edit/view/record-part-source.client';

/**
 * What other plugins hold about this record, drawn INSIDE the section it belongs to.
 *
 * A payment is part of how an order was paid and a shipment is part of how it is delivered; listed in a
 * panel of their own at the foot of the page they read as five separate things. The collection says
 * which of its sections each part belongs in, the provider says which part its records are, and neither
 * names the other.
 *
 * One card draws it in up to four places (`place`): the person the record is for heads the card, the
 * other records follow the card's own values as label / value rows, and what can be started from them
 * (create an invoice, refund) is a button in the title row of a card only parts fill, a row of the card's
 * ⋯ menu otherwise — or, while the part has nothing yet, a button beside the collection's own words for
 * that ("No invoice issued yet").
 */
export class CollectionRecordPart extends Reactor {
  @prop declare links: CollectionRecordLinksDeclaration;
  @prop declare sectionKey: string;
  @prop declare navigate?: (href: string) => void;
  @prop declare place: RecordPartPlace;
  /** The card holds no fields of its own: its actions are buttons in its title row. */
  @prop declare standalone?: boolean;

  @state private items: IRecordsHubItem[] | null = null;
  @state private actions: Array<{ id: string; label: string; href: string; icon?: string; part?: string }> = [];

  private alive = false;

  componentDidMount(): void {
    this.alive = true;
    this.onUnmount(() => { this.alive = false; });
    void this.fetchItems(false);
    // Back from a page that added a record here (an invoice made from this order) restores this page
    // from the browser's memory as it was; read the links again so what was just made is on it.
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) void this.fetchItems(true); };
    window.addEventListener('pageshow', onShow);
    this.onUnmount(() => window.removeEventListener('pageshow', onShow));
  }

  @watch('links')
  protected onLinksChanged(next: CollectionRecordLinksDeclaration, prev: CollectionRecordLinksDeclaration): void {
    if (next?.reloadKey !== prev?.reloadKey) void this.fetchItems(false);
  }

  private async fetchItems(fresh: boolean): Promise<void> {
    try {
      const result = await RecordPartSource.load(this.links.url, fresh);
      if (!this.alive) return;
      this.actions = result.actions;
      this.items = result.items;
    } catch {
      // The linked-records list reports a failed load; a section stays as its own fields.
      if (this.alive) this.items = [];
    }
  }

  @bound private open(item: IRecordsHubItem): void { RecordsHubOpenItem.open(item, this.navigate); }
  @bound private follow(href: string): void { RecordsHubOpenItem.open({ href } as IRecordsHubItem, this.navigate); }
  @bound private download(item: IRecordsHubItem): void { void RecordsHubOpenItem.download(item, this.navigate); }

  /** The person is the console's own row, so its label is the console's word, in the reader's language. */
  private static readonly PERSON_KIND = 'system:person';

  private static isPerson(item: IRecordsHubItem): boolean {
    return item.kind === CollectionRecordPart.PERSON_KIND;
  }

  private static headingOf(item: IRecordsHubItem): string {
    return CollectionRecordPart.isPerson(item) ? AdminI18n.t('collection.edit.recordPart.person') : item.group;
  }

  private groupsOf(term: string): Array<{ group: string; items: IRecordsHubItem[] }> {
    const lead = this.place === RecordPartPlace.LEAD;
    const groups: Array<{ group: string; items: IRecordsHubItem[] }> = [];
    for (const item of this.items || []) {
      if (this.links.termOf(item.part) !== term || CollectionRecordPart.isPerson(item) !== lead) continue;
      const group = CollectionRecordPart.headingOf(item);
      const existing = groups.find((entry) => entry.group === group);
      if (existing) existing.items.push(item); else groups.push({ group, items: [item] });
    }
    return groups;
  }

  private actionsOf(term: string): Array<{ id: string; label: string; href: string; icon?: string }> {
    return this.actions.filter((action) => this.links.termOf(action.part) === term);
  }

  private renderGroups(groups: Array<{ group: string; items: IRecordsHubItem[] }>): ReactNode {
    // A card only one kind of record fills is titled by it already ("Invoices" holding invoices).
    const bare = this.standalone && groups.length === 1;
    return groups.map((entry) => (
      <div key={entry.group} className={bare ? 'fc-record-part__group fc-record-part__group--bare' : 'fc-record-part__group'}>
        {bare ? null : <span className="fc-record-part__heading">{entry.group}</span>}
        <div className="fc-record-part__items">
          {entry.items.map((item) => <RecordPartRow key={`${item.kind}:${item.id}`} item={item} onOpen={this.open} onDownload={this.download} initials={CollectionRecordPart.isPerson(item)} />)}
        </div>
      </div>
    ));
  }

  private renderIcon(icon?: string): ReactNode {
    const Icon = icon ? FrameworkIcons.getIcon(icon) : null;
    return Icon ? <Icon size={15} /> : null;
  }

  /** Nothing yet: the collection's words for that, and the first thing that can be started beside them. */
  private renderEmpty(part: { term: string; empty: string; menu: boolean }): ReactNode {
    const first = this.standalone ? undefined : this.actionsOf(part.term)[0];
    if (!part.empty && !first) return null;
    return (
      <div key={part.term} className="fc-record-part__empty">
        <span className="fc-record-part__empty-text">{this.standalone ? part.empty : <>↳ {part.empty}</>}</span>
        {first ? (
          <button type="button" className="fc-record-part__button" onClick={() => this.follow(first.href)}>
            {this.renderIcon(first.icon)}
            {first.label}
          </button>
        ) : null}
      </div>
    );
  }

  private renderBody(parts: Array<{ term: string; empty: string; menu: boolean }>): ReactNode {
    return parts.map((part) => {
      const groups = this.groupsOf(part.term);
      if (groups.length && part.menu) return null;
      return groups.length ? <Fragment key={part.term}>{this.renderGroups(groups)}</Fragment> : this.renderEmpty(part);
    });
  }

  /** Actions the body does not already offer: in the title row of a card only parts fill, else in its ⋯. */
  private offered(parts: Array<{ term: string; empty: string; menu: boolean }>): Array<{ id: string; label: string; href: string; icon?: string }> {
    return parts.flatMap((part) => {
      const actions = this.actionsOf(part.term);
      const inBody = !this.standalone && this.groupsOf(part.term).length === 0 ? 1 : 0;
      return actions.slice(inBody);
    });
  }

  render(): ReactNode {
    const parts = this.links.partsOf(this.sectionKey);
    // Until the answer is in there is nothing true to say: "none yet" would be a guess.
    if (!parts.length || this.items === null) return null;
    if (this.place === RecordPartPlace.LEAD) {
      const groups = parts.flatMap((part) => this.groupsOf(part.term));
      return groups.length ? <div className="fc-record-part">{this.renderGroups(groups)}</div> : null;
    }
    if (this.place === RecordPartPlace.HEAD) {
      if (!this.standalone) return null;
      return this.offered(parts).map((action) => (
        <button key={action.id} type="button" className="fc-record-part__button" onClick={() => this.follow(action.href)}>
          {this.renderIcon(action.icon)}
          {action.label}
        </button>
      ));
    }
    if (this.place === RecordPartPlace.MENU) {
      if (this.standalone) return null;
      const opened = parts.filter((part) => part.menu).flatMap((part) => this.groupsOf(part.term).flatMap((entry) => entry.items));
      return [...opened.map((item) => (
        <MenuAction
          key={`${item.kind}:${item.id}`}
          label={item.title}
          detail={[item.group, item.status, item.trailing].filter(Boolean).join(' · ')}
          icon={this.renderIcon(item.icon)}
          onClick={() => this.open(item)}
        />
      )), ...this.offered(parts).map((action) => (
        <MenuAction key={action.id} label={action.label} icon={this.renderIcon(action.icon)} onClick={() => this.follow(action.href)} />
      ))];
    }
    const body = this.renderBody(parts);
    return <div className="fc-record-part">{body}</div>;
  }
}
