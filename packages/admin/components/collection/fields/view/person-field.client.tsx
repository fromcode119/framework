import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import Link from 'next/link';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
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

  @bound private onQuery(event: ChangeEvent<HTMLInputElement>): void {
    this.query = event.target.value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.search(), PersonField.SEARCH_DELAY_MS);
  }

  private async search(): Promise<void> {
    const q = this.query.trim();
    if (!q) { this.results = []; this.searched = false; return; }
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

  @bound private unlink(): void {
    this.person = null;
    this.loadedFor = 0;
    this.onChange?.(null);
  }

  private renderLinked(): ReactNode {
    const person = this.person;
    if (!person) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {this.personFailed ? AdminI18n.t('ui.person.readFailed', { id: this.personId }) : AdminI18n.t('common.loading')}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-950/40">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{person.name}</div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400">
            {[person.email, person.phone].filter(Boolean).join(' · ') || AdminI18n.t('ui.person.noContact')}
            {' · '}
            {AdminI18n.t(person.hasLogin ? 'ui.person.hasLogin' : 'ui.person.noLogin')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{AdminI18n.t('ui.person.source', { id: person.id })}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={AdminConstants.ROUTES.PEOPLE.DETAIL(person.id)} className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-[11.5px] font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">{AdminI18n.t('ui.person.open')}</Link>
          {this.readOnly ? null : (
            <Button type="button" size={FieldSize.SM} variant={ButtonVariant.GHOST} onClick={this.unlink}>{AdminI18n.t('ui.person.choose')}</Button>
          )}
        </div>
      </div>
    );
  }

  private renderResults(): ReactNode {
    if (this.searchFailed) return <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">{AdminI18n.t('ui.person.searchFailed')}</p>;
    if (!this.searched) return null;
    if (this.results.length === 0) {
      return <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">{AdminI18n.t('ui.person.noMatch')}</p>;
    }
    return (
      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {this.results.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => this.pick(person)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{person.name}</span>
                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{person.email || person.phone || AdminI18n.t('ui.person.ref', { id: person.id })}</span>
              </span>
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{AdminI18n.t(person.hasLogin ? 'ui.person.hasLogin' : 'ui.person.noLogin')}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  render(): ReactNode {
    if (this.personId) return this.renderLinked();
    if (this.readOnly) return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{AdminI18n.t('ui.person.notLinked')}</p>;
    return (
      <div>
        <Input value={this.query} onChange={this.onQuery} placeholder={AdminI18n.t('ui.person.search')} />
        {this.renderResults()}
      </div>
    );
  }
}
