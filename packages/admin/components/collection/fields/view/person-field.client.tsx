import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import type { IOption } from '@/components/ui/interfaces/option.interface';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PersonFieldPerson } from '@/components/collection/fields/person-field-person';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * "Who is this?" — pick an existing person from People instead of retyping their name and email.
 *
 * Stores the person's id. The collection names, in `admin.personFields` (`{ name, email, phone }` →
 * its own field names), which of its fields the picked person fills; those fields usually carry
 * `admin.condition: { field: <this field>, operator: 'notExists' }`, so they are typed only for
 * someone who is not in People yet — and saving adds that person. Once linked, this card shows the
 * values and where they come from, and People is where they change.
 *
 * Drawn as the reference draws a customer on an order: one searchable select. What People knows about
 * the chosen person sits on one line under it, with the way to People.
 */
export class PersonField extends Reactor {
  private static readonly SEARCH_LIMIT = 8;
  private static readonly SEARCH_DELAY_MS = 250;

  @prop declare value?: unknown;
  @prop declare onChange?: (value: number | null) => void;
  @prop declare onPatch?: (partial: Record<string, unknown>) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  @state person: PersonFieldPerson | null = null;
  /** "Could not be read" is not "no such person": the id stays and the card says so. */
  @state personFailed = false;
  @state query = '';
  @state results: PersonFieldPerson[] = [];
  @state searched = false;
  @state searching = false;
  @state searchFailed = false;
  private loadedFor = -1;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private get personId(): number {
    const id = Number(this.value);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private get readOnly(): boolean {
    return Boolean(this.field?.admin?.readOnly) || Boolean(this.disabled);
  }

  componentDidMount(): void { this.loadIfChanged(); }
  componentDidUpdate(): void { this.loadIfChanged(); }
  componentWillUnmount(): void { if (this.searchTimer) clearTimeout(this.searchTimer); }

  private loadIfChanged(): void {
    if (this.personId === this.loadedFor) return;
    this.loadedFor = this.personId;
    if (!this.personId) { this.person = null; this.personFailed = false; return; }
    void this.loadPerson(this.personId);
  }

  private async loadPerson(id: number): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON(id));
      this.person = PersonFieldPerson.from(response?.person);
      this.personFailed = !this.person;
    } catch {
      this.person = null;
      this.personFailed = true;
    }
  }

  @bound private onQuery(query: string): void {
    this.query = query;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searching = Boolean(query.trim());
    this.searchTimer = setTimeout(() => void this.search(), PersonField.SEARCH_DELAY_MS);
  }

  private async search(): Promise<void> {
    const q = this.query.trim();
    if (!q) { this.results = []; this.searched = false; this.searching = false; return; }
    try {
      const params = new URLSearchParams({ q, limit: String(PersonField.SEARCH_LIMIT) });
      const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.PEOPLE}?${params.toString()}`);
      const rows: unknown[] = Array.isArray(response?.docs) ? response.docs : [];
      this.results = rows.map((row) => PersonFieldPerson.from(row)).filter((p): p is PersonFieldPerson => p !== null);
      this.searchFailed = false;
    } catch {
      this.results = [];
      this.searchFailed = true;
    }
    this.searched = true;
    this.searching = false;
  }

  private pick(person: PersonFieldPerson): void {
    this.person = person;
    this.loadedFor = person.id;
    this.query = '';
    this.results = [];
    this.searched = false;
    this.onChange?.(person.id);
    const patch = person.patchFor(this.field?.admin?.personFields);
    if (Object.keys(patch).length > 0) this.onPatch?.(patch);
  }

  @bound private choose(value: string): void {
    if (!value) { this.unlink(); return; }
    const person = this.results.find((candidate) => String(candidate.id) === value);
    if (person) this.pick(person);
  }

  private unlink(): void {
    this.person = null;
    this.loadedFor = 0;
    this.onChange?.(null);
  }

  /** Email and phone, without the one that is already the person's name (someone known only by email). */
  private contact(person: PersonFieldPerson): string[] {
    return [person.email, person.phone].filter((part): part is string => Boolean(part) && part !== person.name);
  }

  private label(person: PersonFieldPerson): string {
    return [person.name, this.contact(person)[0]].filter(Boolean).join(' · ');
  }

  /** The search's answer, and the linked person, so the select can name what it holds. */
  private get options(): IOption[] {
    const options = this.results.map((person) => ({ value: String(person.id), label: this.label(person) }));
    if (this.personId && !options.some((option) => option.value === String(this.personId))) {
      options.unshift({ value: String(this.personId), label: this.person ? this.person.name : AdminI18n.t('ui.person.ref', { id: this.personId }) });
    }
    return options;
  }

  private get menuNote(): string | undefined {
    if (this.searchFailed) return AdminI18n.t('ui.person.searchFailed');
    if (this.searched && this.results.length === 0) return AdminI18n.t('ui.person.noMatch');
    return undefined;
  }

  /** One line under the select: what People holds for the linked person, and the way there. */
  private renderLinked(): ReactNode {
    const person = this.person;
    if (!person) {
      return this.personFailed ? <p className="fc-person-field__meta fc-person-field__meta--warn">{AdminI18n.t('ui.person.readFailed', { id: this.personId })}</p> : null;
    }
    const contact = person.email || person.phone ? this.contact(person) : [AdminI18n.t('ui.person.noContact')];
    return (
      <p className="fc-person-field__meta">
        <span>{[...contact, AdminI18n.t(person.hasLogin ? 'ui.person.hasLogin' : 'ui.person.noLogin')].join(' · ')}</span>
        <AdminLink href={AdminConstants.ROUTES.PEOPLE.DETAIL(person.id)} className="fc-person-field__open">{AdminI18n.t('ui.person.open')}</AdminLink>
      </p>
    );
  }

  render(): ReactNode {
    const loading = Boolean(this.personId) && !this.person && !this.personFailed;
    return (
      <div className="fc-person-field">
        <Select
          value={this.personId ? String(this.personId) : ''}
          onChange={this.choose}
          options={this.options}
          searchable
          onSearchChange={this.onQuery}
          searching={this.searching}
          menuNote={this.menuNote}
          clearable={!this.readOnly}
          isLoading={loading}
          disabled={this.readOnly}
          theme={this.theme}
          placeholder={AdminI18n.t(this.readOnly ? 'ui.person.notLinked' : 'ui.person.search')}
        />
        {this.personId ? this.renderLinked() : null}
      </div>
    );
  }
}


