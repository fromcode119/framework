import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop, state, bound, watch } from '@fromcode119/reactor';
import { Select } from '@/components/ui/view/select.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CollectionKeyUtils } from '@/components/collection/collection-key-utils';
import { RelationshipSelectLocalUtils } from '@/components/collection/relationship-select-local-utils';
import { RelationshipSelectLocalFetcher } from '@/components/collection/relationship-select-local-fetcher';
import type { SelectOption } from '@/components/collection/select-option';

export class RelationshipSelectLocal extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<RelationshipSelectLocal, 'field' | 'value' | 'onChange' | 'themeMode' | 'onPatch'>;

  @prop declare field: any;
  @prop declare value: any;
  @prop declare onChange: (val: any) => void;
  @prop declare themeMode: ThemeMode;
  /** Patch sibling fields live when a related record is picked (schema `admin.autofill`). */
  @prop declare onPatch?: (partial: Record<string, any>) => void;

  @state private search = '';
  @state private options: SelectOption[] = [];

  private rawValueMap: Record<string, any> = {};
  private docByKey: Record<string, any> = {};
  private fetchToken = 0;

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
  }

  componentDidMount(): void {
    void this.fetchOptions();
  }

  componentWillUnmount(): void {
    this.fetchToken++;
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
        placeholder={`Select ${field.label || field.name || 'record'}...`}
        searchable
        onSearchChange={(v: string) => { this.search = v; }}
        theme={themeMode}
        clearable={Boolean(field.admin?.clearable)}
      />
    );
  }
}
