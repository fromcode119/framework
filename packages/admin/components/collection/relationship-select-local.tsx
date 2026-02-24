"use client";

import React from 'react';
import { queryCollectionDocByField, queryCollectionDocById, queryCollectionDocs, usePlugins } from '@fromcode119/react';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { resolveLabelText } from '@/lib/utils';

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

const toScalar = (input: any): string => {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string' || typeof input === 'number') return String(input);
  if (typeof input === 'object') {
    const fromObject = input.id ?? input._id ?? input.value ?? input.slug ?? '';
    return String(fromObject || '');
  }
  return String(input);
};

export const RelationshipSelectLocal: React.FC<RelationshipSelectLocalProps> = ({ field, value, onChange, theme }) => {
  const { collections } = usePlugins();
  const sourceCollectionSlug = field.admin?.sourceCollection || field.relationTo;
  const sourceCollection = collections.find((c: any) => c.slug === sourceCollectionSlug);
  const preferredLabelField =
    sourceCollection?.admin?.useAsTitle ||
    (sourceCollectionSlug === 'users' ? 'username' : sourceCollectionSlug === 'media' ? 'filename' : 'name');
  const lookupField = field.admin?.sourceField || preferredLabelField;

  const currentValue = React.useMemo(() => toScalar(value), [value]);
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
        const optionValue = toScalar(rawValue);
        if (!optionValue || seen.has(optionValue)) continue;
        seen.add(optionValue);
        rawValueMapRef.current[optionValue] = rawValue ?? optionValue;
        const preferredLabel =
          resolveLabelText(doc?.[preferredLabelField]) ||
          resolveLabelText(doc?.[lookupField]) ||
          resolveLabelText(doc);
        mapped.push({
          value: optionValue,
          label: preferredLabel || optionValue
        });
      }
      return mapped;
    };

    const fetchOptions = async () => {
      try {
        const docs = await queryCollectionDocs(api, sourceCollectionSlug, {
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
          const byId = await queryCollectionDocById(api, sourceCollectionSlug, currentValue);
          const resolved = mapDocsToOptions([byId])[0];
          if (resolved && !disposed) upsertOption(resolved);
        } catch {
          try {
            const byFieldDoc = await queryCollectionDocByField(api, sourceCollectionSlug, lookupField, currentValue, 1);
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
