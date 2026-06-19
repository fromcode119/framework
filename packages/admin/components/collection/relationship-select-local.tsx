"use client";

import React from 'react';
import { Select } from '@/components/ui/select';
import { AdminComponent } from '@/components/admin-component';
import { CollectionKeyUtils } from './collection-key-utils';
import { RelationshipSelectLocalUtils } from './relationship-select-local-utils';
import { RelationshipSelectLocalFetcher } from './relationship-select-local-fetcher';
import type {
  RelationshipSelectLocalProps,
  RelationshipSelectLocalState,
  SelectOption
} from './relationship-select-local.interfaces';

export class RelationshipSelectLocal extends AdminComponent<RelationshipSelectLocalProps, RelationshipSelectLocalState> {
  state: RelationshipSelectLocalState = { search: '', options: [] };
  private rawValueMap: Record<string, any> = {};
  private docByKey: Record<string, any> = {};
  private fetchToken = 0;

  private get plugins(): any {
    return this.runtime?.plugins ?? {};
  }

  private getSourceSlugs(): string[] {
    const { field } = this.props;
    const requestedSourceCollection = field.admin?.sourceCollection || field.relationTo;
    return CollectionKeyUtils.resolveSourceSlugs(requestedSourceCollection, this.plugins.collections || []);
  }

  private isMultiSource(): boolean {
    return this.getSourceSlugs().length > 1;
  }

  private getCurrentTarget(): any {
    return RelationshipSelectLocalUtils.resolveRelationTarget(this.props.value);
  }

  private getCurrentValue(): any {
    return RelationshipSelectLocalUtils.toScalar(this.props.value);
  }

  private getCurrentSelectValue(): string {
    const currentValue = this.getCurrentValue();
    if (!currentValue) return '';
    if (!this.isMultiSource() || !this.getCurrentTarget()) return currentValue;
    return RelationshipSelectLocalUtils.toOptionKey(currentValue, this.getCurrentTarget());
  }

  private upsertOption = (option: SelectOption): void => {
    if (!option.value) return;
    this.setState((prev) => {
      if (prev.options.some((entry) => entry.value === option.value)) return null;
      return { options: [option, ...prev.options] };
    });
  };

  private fetchOptions = async (): Promise<void> => {
    const token = ++this.fetchToken;
    const { collections, api } = this.plugins;
    const fetcher = new RelationshipSelectLocalFetcher({
      field: this.props.field,
      value: this.props.value,
      api,
      collections,
      sourceCollectionSlugs: this.getSourceSlugs(),
      isMultiSource: this.isMultiSource(),
      currentTarget: this.getCurrentTarget(),
      currentValue: this.getCurrentValue(),
      currentSelectValue: this.getCurrentSelectValue(),
      search: this.state.search,
      docByKey: this.docByKey,
      rawValueMap: this.rawValueMap,
      disposed: () => token !== this.fetchToken,
      setOptions: (options) => this.setState({ options }),
      upsertOption: this.upsertOption
    });
    await fetcher.fetch();
  };

  componentDidMount(): void {
    void this.fetchOptions();
  }

  componentDidUpdate(prevProps: RelationshipSelectLocalProps, prevState: RelationshipSelectLocalState): void {
    if (prevProps.value !== this.props.value || prevState.search !== this.state.search) {
      void this.fetchOptions();
    }
  }

  componentWillUnmount(): void {
    this.fetchToken++;
  }

  private applyAutofill(key: string): void {
    const { field, onPatch } = this.props;
    const autofill = field?.admin?.autofill;
    if (!onPatch || !autofill) return;
    const doc = this.docByKey[key];
    if (!doc) return;
    const patch = RelationshipSelectLocalUtils.buildAutofillPatch(doc, autofill);
    if (Object.keys(patch).length > 0) onPatch(patch);
  }

  render(): React.ReactNode {
    const { field, onChange, theme } = this.props;
    const { options } = this.state;
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
        onSearchChange={(v: string) => this.setState({ search: v })}
        theme={theme}
        clearable={Boolean(field.admin?.clearable)}
      />
    );
  }
}
