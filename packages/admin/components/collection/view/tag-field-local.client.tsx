import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { CollectionKeyUtils } from '@/components/collection/collection-key-utils';

export class TagFieldLocal extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<TagFieldLocal, 'field' | 'value' | 'onChange' | 'themeMode' | 'collectionSlug'>;

  @prop declare field: any;
  @prop declare value: any;
  @prop declare onChange: (val: any) => void;
  @prop declare themeMode: ThemeMode;
  @prop declare collectionSlug: string;

  render(): ReactNode {
    const { field, value, onChange, themeMode, collectionSlug } = this;
    const collections = this.collections;
    const isRelationshipField = field.type === 'relationship';
    const requestedSourceCollection = field.admin?.sourceCollection || field.relationTo;
    const sourceCollectionSlug = CollectionKeyUtils.resolveSourceSlug(requestedSourceCollection, collections || []);
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
    const safeValue = (() => {
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
    })();

    return (
    <TagField 
      collectionSlug={collectionSlug}
      fieldName={field.name}
      value={safeValue}
      onChange={onChange}
      theme={themeMode}
      sourceCollection={sourceCollectionSlug}
      sourceField={targetField}
      hasMany={field.hasMany !== undefined ? field.hasMany : (field.admin?.component === 'TagField' || field.admin?.component === 'Tags')}
      // Relationship fields should only reference existing docs; avoid accidental auto-create.
      allowCreate={!isRelationshipField && sourceCollectionSlug !== 'users' && sourceCollectionSlug !== 'media'}
      placeholder={field.admin?.placeholder || undefined}
      suggestionsLabel={field.admin?.suggestionsLabel || undefined}
    />
    );
  }
}
