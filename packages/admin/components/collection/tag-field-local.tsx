"use client";

import React from 'react';
import { ContextHooks } from '@fromcode119/react';
import { TagField } from '@/components/ui/tag-field';
import { CollectionKeyUtils } from './collection-key-utils';

interface TagFieldLocalProps {
  field: any;
  value: any;
  onChange: (val: any) => void;
  theme: string;
  collectionSlug: string;
}

export const TagFieldLocal: React.FC<TagFieldLocalProps> = ({ field, value, onChange, theme, collectionSlug }) => {
  const { collections } = ContextHooks.usePlugins();
  const isRelationshipField = field.type === 'relationship';
  const requestedSourceCollection = field.admin?.sourceCollection || field.relationTo;
  const sourceCollectionSlug = React.useMemo(
    () => CollectionKeyUtils.resolveSourceSlug(requestedSourceCollection, collections || []),
    [collections, requestedSourceCollection]
  );
  const sourceCollection = collections.find((c: any) => c.slug === sourceCollectionSlug);
  
  const targetField = sourceCollectionSlug
    ? (
        field.admin?.sourceField ||
        sourceCollection?.admin?.useAsTitle ||
        (sourceCollectionSlug === 'users'
          ? 'username'
          : sourceCollectionSlug === 'media'
            ? 'filename'
            : 'slug')
      )
    : field.admin?.sourceField;

  // Ensure relationship values that might be raw objects or slugs are handled correctly
  const safeValue = React.useMemo(() => {
    if (!value) return field.hasMany ? [] : '';
    
    // If it's single-select and we have a string, it's already a slug/ID
    if (!field.hasMany && typeof value === 'string') return value;
    
    // If it's an object with a label, it's from the Select/TagField UI or API
    // We want the underlying ID/slug for the input/logic
    if (!field.hasMany && typeof value === 'object' && value !== null) {
      return value.value || value.slug || value.id || value;
    }

    if (field.hasMany && Array.isArray(value)) {
       return value.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
             return item.value || item.slug || item.id || item;
          }
          return item;
       });
    }

    return value;
  }, [value, field.hasMany]);

  return (
    <TagField 
      collectionSlug={collectionSlug}
      fieldName={field.name}
      value={safeValue}
      onChange={onChange}
      theme={theme}
      sourceCollection={sourceCollectionSlug}
      sourceField={targetField}
      hasMany={field.hasMany !== undefined ? field.hasMany : (field.admin?.component === 'TagField' || field.admin?.component === 'Tags')}
      // Relationship fields should only reference existing docs; avoid accidental auto-create.
      allowCreate={!isRelationshipField && sourceCollectionSlug !== 'users' && sourceCollectionSlug !== 'media'}
      placeholder={field.admin?.placeholder || undefined}
      suggestionsLabel={field.admin?.suggestionsLabel || undefined}
    />
  );
};
