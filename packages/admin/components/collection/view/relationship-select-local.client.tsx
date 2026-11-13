import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop, state, bound, watch } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CollectionKeyUtils } from '@/components/collection/collection-key-utils';
import { RelationshipSelectLocalUtils } from '@/components/collection/relationship-select-local-utils';
import { RelationshipSelectLocalFetcher } from '@/components/collection/relationship-select-local-fetcher';
import type { SelectOption } from '@/components/collection/select-option';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class RelationshipSelectLocal extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<RelationshipSelectLocal, 'field' | 'value' | 'onChange' | 'themeMode' | 'onPatch' | 'disabled'>;

  @prop declare field: any;
  @prop declare value: any;
  @prop declare onChange: (val: any) => void;
  @prop declare themeMode: ThemeMode;
  /** Patch sibling fields live when a related record is picked (schema `admin.autofill`). */
  @prop declare onPatch?: (partial: Record<string, any>) => void;
  /** A locked (read-only) field shows the related record but cannot be repointed until it is unlocked. */
  @prop declare disabled?: boolean;

  @state private search = '';
  @state private options: SelectOption[] = [];
  /** A read is in flight for what was typed, so an empty menu is not reported as an empty collection. */
  @state private searching = false;

  private rawValueMap: Record<string, any> = {};
  private docByKey: Record<string, any> = {};
  private fetchToken = 0;
  /** Typing used to read the collection on EVERY keystroke; this waits for the operator to pause. */
  private searchTimer: number | null = null;
  private static readonly SEARCH_DEBOUNCE_MS = 250;

  private get plugins(): any {
    return this.runtime?.plugins ?? {};
  }

  private getSourceSlugs(): string[] {
    const requestedSourceCollection = this.field.admin?.sourceCollection || this.field.relationTo;
    return CollectionKeyUtils.resolveSourceSlugs(requestedSourceCollection, this.plugins.collections || []);
  }

  private isMultiSource(): boolean {
    return this.getSourceSlugs().length > 1;
  }

  private getCurrentTarget(): any {
    return RelationshipSelectLocalUtils.resolveRelationTarget(this.value);
  }

  private getCurrentValue(): any {
    return RelationshipSelectLocalUtils.toScalar(this.value);
  }

  private getCurrentSelectValue(): string {
    const currentValue = this.getCurrentValue();
    if (!currentValue) return '';
    if (!this.isMultiSource() || !this.getCurrentTarget()) return currentValue;
    return RelationshipSelectLocalUtils.toOptionKey(currentValue, this.getCurrentTarget());
  }

  @bound
  private upsertOption(option: SelectOption): void {
    if (!option.value) return;
    if (this.options.some((entry) => entry.value === option.value)) return;
    this.options = [option, ...this.options];
  }

  // Runs on mount (componentDidMount) and whenever `value` or `search` changes (@watch snapshots
  // previous values reliably — `@state` mutates `this.state` in place, so `prevState` is unreliable).
  @watch('value', 'search')
  private async fetchOptions(): Promise<void> {
    const token = ++this.fetchToken;
    this.searching = true;
    const { collections, api } = this.plugins;
    const fetcher = new RelationshipSelectLocalFetcher({
      field: this.field,
      value: this.value,
      api,
      collections,
      sourceCollectionSlugs: this.getSourceSlugs(),
      isMultiSource: this.isMultiSource(),
      currentTarget: this.getCurrentTarget(),
      currentValue: this.getCurrentValue(),
      currentSelectValue: this.getCurrentSelectValue(),
      search: this.search,
      docByKey: this.docByKey,
      rawValueMap: this.rawValueMap,
      disposed: () => token !== this.fetchToken,
      setOptions: (options) => { this.options = options; },
      upsertOption: this.upsertOption
    });
    await fetcher.fetch();
    // Only the newest read may clear the flag: an older one finishing later would otherwise say the
    // menu is settled while the current search is still running.
    if (token === this.fetchToken) this.searching = false;
  }

  /** The typed text, once the operator pauses — not one read of the collection per keystroke. */
  @bound
  private onSearchChange(next: string): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    // Closing the menu reports an empty search: with nothing typed, that is not a change to read for.
    if (next === this.search) return;
    this.searchTimer = window.setTimeout(() => { this.search = next; }, RelationshipSelectLocal.SEARCH_DEBOUNCE_MS);
  }

  /**
   * What the list is not saying by itself: that it stopped at the read limit. Shown only when the read
   * actually filled it — a shorter list IS everything that matched.
   */
  private get menuNote(): string | undefined {
    if (this.searching || this.options.length < RelationshipSelectLocalFetcher.PAGE_LIMIT) return undefined;
    return AdminI18n.t('ui.select.showingFirst', { count: RelationshipSelectLocalFetcher.PAGE_LIMIT });
  }

  componentDidMount(): void {
    void this.fetchOptions();
  }

  componentWillUnmount(): void {
    this.fetchToken++;
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
  }

  private applyAutofill(key: string): void {
    const autofill = this.field?.admin?.autofill;
    if (!this.onPatch || !autofill) return;
    const doc = this.docByKey[key];
    if (!doc) return;
    const patch = RelationshipSelectLocalUtils.buildAutofillPatch(doc, autofill);
    if (Object.keys(patch).length > 0) this.onPatch(patch);
  }

  render(): ReactNode {
    const { field, onChange, themeMode, options } = this;
    const isMultiSource = this.isMultiSource();
    const currentSelectValue = this.getCurrentSelectValue();

    return (
      <Select
        value={currentSelectValue}
        onChange={(next) => {
          const key = String(next || '').trim();
          if (!key) {
            onChange('');
            return;
          }
          this.applyAutofill(key);
          const rawValue = this.rawValueMap[key];
          if (rawValue !== undefined) {
            onChange(rawValue);
            return;
          }
          if (!isMultiSource) {
            onChange(key);
            return;
          }
          const parsed = RelationshipSelectLocalUtils.parseOptionKey(key);
          onChange(RelationshipSelectLocalUtils.buildTaggedValue(parsed.scalar, parsed.relationTo));
        }}
        options={options}
        placeholder={AdminI18n.t('ui.field.selectRelated', { label: field.label || field.name || AdminI18n.t('ui.field.record') })}
        searchable
        onSearchChange={this.onSearchChange}
        searching={this.searching}
        menuNote={this.menuNote}
        theme={themeMode}
        disabled={this.disabled}
        clearable={Boolean(field.admin?.clearable)}
      />
    );
  }
}
