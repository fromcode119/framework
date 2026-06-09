"use client";

import React from 'react';
import { CollectionQueryUtils } from '@fromcode119/react';
import { Select } from '@/components/ui/select';
import { AdminComponent } from '@/components/admin-component';
import { AdminServices } from '@/lib/admin-services';
import { CollectionKeyUtils } from './collection-key-utils';
import { RelationshipSelectLocalUtils } from './relationship-select-local-utils';

interface RelationshipSelectLocalProps {
  field: any;
  value: any;
  onChange: (val: any) => void;
  theme: string;
  /** All current form values — lets autofill avoid clobbering existing siblings if needed. */
  record?: Record<string, any>;
  /** Patch sibling fields live when a related record is picked (schema `admin.autofill`). */
  onPatch?: (partial: Record<string, any>) => void;
}

interface SelectOption {
  label: string;
  value: string;
}

interface RelationshipSelectLocalState {
  search: string;
  options: SelectOption[];
}

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
    const disposed = () => token !== this.fetchToken;
    const { field, value } = this.props;
    const { collections, api } = this.plugins;
    const sourceCollectionSlugs = this.getSourceSlugs();
    const isMultiSource = this.isMultiSource();
    const currentTarget = this.getCurrentTarget();
    const currentValue = this.getCurrentValue();
    const currentSelectValue = this.getCurrentSelectValue();
    const search = this.state.search;
    if (!sourceCollectionSlugs.length) return;

    const resolveLookupField = (sourceCollectionSlug: string): string => {
      const sourceCollection = (collections || []).find((entry: any) => entry.slug === sourceCollectionSlug);
      const preferredLabelField =
        sourceCollection?.admin?.useAsTitle ||
        (sourceCollectionSlug === 'users' ? 'username' : sourceCollectionSlug === 'media' ? 'filename' : 'name');
      return field.admin?.sourceField || preferredLabelField;
    };

    const mapDocsToOptions = (docs: any[], sourceCollectionSlug: string): SelectOption[] => {
      const seen = new Set<string>();
      const mapped: SelectOption[] = [];
      const lookupField = resolveLookupField(sourceCollectionSlug);
      for (const doc of docs) {
        const rawValue = doc?.id ?? doc?._id ?? doc?.value ?? doc?.slug;
        const scalarValue = RelationshipSelectLocalUtils.toScalar(rawValue);
        const optionValue = isMultiSource
          ? RelationshipSelectLocalUtils.toOptionKey(scalarValue, sourceCollectionSlug)
          : scalarValue;
        if (!optionValue || seen.has(optionValue)) continue;
        seen.add(optionValue);
        this.docByKey[optionValue] = doc;
        this.rawValueMap[optionValue] = isMultiSource
          ? RelationshipSelectLocalUtils.buildTaggedValue(rawValue ?? scalarValue, sourceCollectionSlug)
          : rawValue ?? optionValue;
        const preferredLabel =
          AdminServices.getInstance().localization.resolveLabelText(doc?.[lookupField]) ||
          AdminServices.getInstance().localization.resolveLabelText(doc);
        mapped.push({
          value: optionValue,
          label: preferredLabel || optionValue
        });
      }
      return mapped;
    };

    try {
      const responses = await Promise.all(
        sourceCollectionSlugs.map(async (sourceCollectionSlug) => {
          const docs = await CollectionQueryUtils.queryCollectionDocs(api, sourceCollectionSlug, {
            limit: 30,
            search: search.trim() || undefined
          });
          return mapDocsToOptions(docs, sourceCollectionSlug);
        })
      );
      const nextOptions = responses.flat().filter((option, index, entries) => (
        entries.findIndex((entry) => entry.value === option.value) === index
      ));

      if (!disposed()) {
        this.setState({ options: nextOptions });
      }

      if (!currentValue || nextOptions.some((option) => option.value === currentSelectValue)) return;

      // Ensure the currently selected value resolves to a label.
      const candidateSlugs = currentTarget && isMultiSource
        ? [currentTarget, ...sourceCollectionSlugs.filter((entry) => entry !== currentTarget)]
        : sourceCollectionSlugs;

      for (const sourceCollectionSlug of candidateSlugs) {
        const lookupField = resolveLookupField(sourceCollectionSlug);
        try {
          const byId = await CollectionQueryUtils.queryCollectionDocById(api, sourceCollectionSlug, currentValue);
          const resolved = mapDocsToOptions([byId], sourceCollectionSlug)[0];
          if (resolved && !disposed()) {
            this.upsertOption(resolved);
            return;
          }
        } catch {
          try {
            const byFieldDoc = await CollectionQueryUtils.queryCollectionDocByField(api, sourceCollectionSlug, lookupField, currentValue, 1);
            const resolved = byFieldDoc ? mapDocsToOptions([byFieldDoc], sourceCollectionSlug)[0] : undefined;
            if (resolved && !disposed()) {
              this.upsertOption(resolved);
              return;
            }
          } catch {
            continue;
          }
        }
      }

      if (!disposed()) {
        this.rawValueMap[currentSelectValue || currentValue] = value;
        this.upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
      }
    } catch {
      if (!disposed() && currentValue) {
        this.rawValueMap[currentSelectValue || currentValue] = value;
        this.upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
      }
    }
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
