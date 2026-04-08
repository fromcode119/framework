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
  const sourceCollectionSlugs = React.useMemo(
    () => CollectionKeyUtils.resolveSourceSlugs(requestedSourceCollection, collections || []),
    [collections, requestedSourceCollection]
  );
  const isMultiSource = sourceCollectionSlugs.length > 1;
  const currentTarget = React.useMemo(() => RelationshipSelectLocalUtils.resolveRelationTarget(value), [value]);

  const currentValue = React.useMemo(() => RelationshipSelectLocalUtils.toScalar(value), [value]);
  const currentSelectValue = React.useMemo(() => {
    if (!currentValue) return '';
    if (!isMultiSource || !currentTarget) return currentValue;
    return RelationshipSelectLocalUtils.toOptionKey(currentValue, currentTarget);
  }, [currentTarget, currentValue, isMultiSource]);
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
    if (!sourceCollectionSlugs.length) return () => { disposed = true; };

    const resolveLookupField = (sourceCollectionSlug: string): string => {
      const sourceCollection = collections.find((entry: any) => entry.slug === sourceCollectionSlug);
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
        rawValueMapRef.current[optionValue] = isMultiSource
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

    const fetchOptions = async () => {
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

        if (!disposed) {
          setOptions(nextOptions);
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
            if (resolved && !disposed) {
              upsertOption(resolved);
              return;
            }
          } catch {
            try {
              const byFieldDoc = await CollectionQueryUtils.queryCollectionDocByField(api, sourceCollectionSlug, lookupField, currentValue, 1);
              const resolved = byFieldDoc ? mapDocsToOptions([byFieldDoc], sourceCollectionSlug)[0] : undefined;
              if (resolved && !disposed) {
                upsertOption(resolved);
                return;
              }
            } catch {
              continue;
            }
          }
        }

        if (!disposed) {
          rawValueMapRef.current[currentSelectValue || currentValue] = value;
          upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
        }
      } catch {
        if (!disposed && currentValue) {
          rawValueMapRef.current[currentSelectValue || currentValue] = value;
          upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
        }
      }
    };

    fetchOptions();
    return () => {
      disposed = true;
    };
  }, [api, collections, currentSelectValue, currentTarget, currentValue, field.admin?.sourceField, isMultiSource, search, sourceCollectionSlugs, upsertOption, value]);

  return (
    <Select
      value={currentSelectValue}
      onChange={(next) => {
        const key = String(next || '').trim();
        if (!key) {
          onChange('');
          return;
        }
        const rawValue = rawValueMapRef.current[key];
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
      onSearchChange={setSearch}
      theme={theme}
    />
  );
};
