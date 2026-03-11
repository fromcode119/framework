"use client";

import React from 'react';
import { CollectionQueryUtils, ContextHooks } from '@fromcode119/react';
import { Select } from '@/components/ui/select';
import { AdminServices } from '@/lib/admin-services';

interface RelationshipSelectLocalProps {
  field: any;
  value: any;
  onChange: (val: any) => void;
  theme: string;
}

interface SelectOption {
  label: string;
  value: string;
}

import { CollectionKeyUtils } from './collection-key-utils';
import { RelationshipSelectLocalUtils } from './relationship-select-local-utils';

export const RelationshipSelectLocal: React.FC<RelationshipSelectLocalProps> = ({ field, value, onChange, theme }) => {
  const { collections, api } = ContextHooks.usePlugins();
  const requestedSourceCollection = field.admin?.sourceCollection || field.relationTo;
  const sourceCollectionSlug = React.useMemo(
    () => CollectionKeyUtils.resolveSourceSlug(requestedSourceCollection, collections || []),
    [collections, requestedSourceCollection]
  );
  const sourceCollection = collections.find((c: any) => c.slug === sourceCollectionSlug);
  const preferredLabelField =
    sourceCollection?.admin?.useAsTitle ||
    (sourceCollectionSlug === 'users' ? 'username' : sourceCollectionSlug === 'media' ? 'filename' : 'name');
  const lookupField = field.admin?.sourceField || preferredLabelField;

  const currentValue = React.useMemo(() => RelationshipSelectLocalUtils.toScalar(value), [value]);
  const [search, setSearch] = React.useState('');
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const rawValueMapRef = React.useRef<Record<string, any>>({});

  const upsertOption = React.useCallback((option: SelectOption) => {
    if (!option.value) return;
    setOptions((prev) => {
      if (prev.some((entry) => entry.value === option.value)) return prev;
      return [option, ...prev];
    });
  }, []);

  React.useEffect(() => {
    let disposed = false;
    if (!sourceCollectionSlug) return () => { disposed = true; };

    const mapDocsToOptions = (docs: any[]): SelectOption[] => {
      const seen = new Set<string>();
      const mapped: SelectOption[] = [];
      for (const doc of docs) {
        const rawValue = doc?.id ?? doc?._id ?? doc?.value ?? doc?.slug;
        const optionValue = RelationshipSelectLocalUtils.toScalar(rawValue);
        if (!optionValue || seen.has(optionValue)) continue;
        seen.add(optionValue);
        rawValueMapRef.current[optionValue] = rawValue ?? optionValue;
        const preferredLabel =
          AdminServices.getInstance().localization.resolveLabelText(doc?.[preferredLabelField]) ||
          AdminServices.getInstance().localization.resolveLabelText(doc?.[lookupField]) ||
          AdminServices.getInstance().localization.resolveLabelText(doc);
        mapped.push({
          value: optionValue,
          label: preferredLabel || optionValue
        });
      }
      return mapped;
    };

    const fetchOptions = async () => {
      try {
        const docs = await CollectionQueryUtils.queryCollectionDocs(api, sourceCollectionSlug, {
          limit: 30,
          search: search.trim() || undefined
        });
        const nextOptions = mapDocsToOptions(docs);

        if (!disposed) {
          setOptions(nextOptions);
        }

        if (!currentValue || nextOptions.some((option) => option.value === currentValue)) return;

        // Ensure the currently selected value resolves to a label.
        try {
          const byId = await CollectionQueryUtils.queryCollectionDocById(api, sourceCollectionSlug, currentValue);
          const resolved = mapDocsToOptions([byId])[0];
          if (resolved && !disposed) upsertOption(resolved);
        } catch {
          try {
            const byFieldDoc = await CollectionQueryUtils.queryCollectionDocByField(api, sourceCollectionSlug, lookupField, currentValue, 1);
            const resolved = byFieldDoc ? mapDocsToOptions([byFieldDoc])[0] : undefined;
            if (resolved && !disposed) upsertOption(resolved);
          } catch {
            if (!disposed) {
              rawValueMapRef.current[currentValue] = value;
              upsertOption({ value: currentValue, label: currentValue });
            }
          }
        }
      } catch {
        if (!disposed && currentValue) {
          rawValueMapRef.current[currentValue] = value;
          upsertOption({ value: currentValue, label: currentValue });
        }
      }
    };

    fetchOptions();
    return () => {
      disposed = true;
    };
  }, [sourceCollectionSlug, preferredLabelField, lookupField, search, currentValue, upsertOption, value]);

  return (
    <Select
      value={currentValue}
      onChange={(next) => {
        const key = String(next || '').trim();
        if (!key) {
          onChange('');
          return;
        }
        onChange(rawValueMapRef.current[key] ?? key);
      }}
      options={options}
      placeholder={`Select ${field.label || field.name || 'record'}...`}
      searchable
      onSearchChange={setSearch}
      theme={theme}
    />
  );
};
