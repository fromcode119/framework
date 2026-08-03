import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import React from 'react';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Input } from '@/components/ui/view/input.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Select } from '@/components/ui/view/select.client';
import { BooleanToggleField } from '@/components/ui/view/boolean-toggle-field.client';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { RelationshipSelectLocal } from '@/components/collection/view/relationship-select-local.client';
import { TagFieldLocal } from '@/components/collection/view/tag-field-local.client';

/**
 * Resolves the correct admin control for a single array sub-field, mirroring the
 * top-level FieldRenderer (custom `admin.component`, relationship, tags, select,
 * boolean, fallback Input). Rendering and prop wiring are unchanged.
 */
export class ArrayFieldRowRenderer extends PureReactor {
  @prop declare field: any;
  @prop declare item: any;
  @prop declare index: number;
  @prop declare theme?: ThemeMode;
  @prop declare collectionSlug: string;
  @prop declare pluginSettings?: Record<string, any>;
  @prop declare fieldComponents?: Record<string, any>;
  @prop declare items: any[];
  @prop declare onUpdateItem: (index: number, name: string, val: any) => void;
  @prop declare onChange: (value: any[]) => void;

  private resolveCustomComponent(isTagComponent: boolean): ReactNode {
    const f = this.field;
    const { item, index, fieldComponents, theme, collectionSlug, pluginSettings, items, onChange, onUpdateItem } = this;
    const componentName: string | undefined = f.admin?.component;
    if (!componentName || isTagComponent) return null;

    const registry = fieldComponents || {};
    const registered = registry[componentName];
    if (!registered) return null;

    let Component: any = registered;
    if (typeof registered === 'object' && !registered.$$typeof) {
      Component = registered.component || registered.Component || registered.render || registered.default || registered;
    }
    if (typeof Component !== 'function' && typeof Component !== 'string') return null;

    return React.createElement(Component, {
      value: item[f.name],
      onChange: (next: any) => onUpdateItem(index, f.name, next?.target ? next.target.value : next),
      theme,
      field: f,
      collectionSlug,
      pluginSettings,
      readOnly: Boolean(f.admin?.readOnly),
      disabled: Boolean(f.admin?.readOnly),
      record: item,
      onPatch: (partial: Record<string, any>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...partial };
        onChange(newItems);
      },
    });
  }

  render(): ReactNode {
    const f = this.field;
    const { item, index, theme, collectionSlug, onUpdateItem } = this;
    const val = item[f.name];
    const fieldProps = {
      value: val,
      onChange: (v: any) => {
        const value = v?.target ? v.target.value : v;
        onUpdateItem(index, f.name, value);
      },
      theme,
      placeholder: `Enter ${f.label || f.name}...`,
    };

    const isTagComponent =
      f.admin?.component === './tag-field' ||
      f.admin?.component === 'TagField' ||
      f.admin?.component === 'Tags';
    const hasMany = f.hasMany !== undefined ? f.hasMany : isTagComponent;

    // Honour a plugin-registered custom `admin.component` (e.g. FinanceCurrencyField) for
    // array sub-fields, the same way the top-level FieldRenderer does — otherwise a sub-field
    // that declares a component silently falls through to a plain text Input. Resolve from the
    // shared fieldComponents registry; built-in component names (Tags/relationship) are handled
    // by the branches below and intentionally skipped here.
    const customComponentNode = this.resolveCustomComponent(isTagComponent);
    if (customComponentNode) return customComponentNode;

    if (f.type === 'relationship' && !hasMany) {
      return (
        <RelationshipSelectLocal
          field={f}
          value={val}
          onChange={(next) => onUpdateItem(index, f.name, next)}
          themeMode={theme || ThemeMode.LIGHT}
        />
      );
    }

    if (f.type === 'relationship') {
       return (
        <TagFieldLocal
          field={f}
          value={val}
          onChange={(next) => onUpdateItem(index, f.name, next)}
          themeMode={theme || ThemeMode.LIGHT}
          collectionSlug={collectionSlug}
        />
       );
    }

    if (isTagComponent) {
       return (
        <TagField
          {...fieldProps}
          collectionSlug={collectionSlug}
          fieldName={f.name}
          sourceCollection={f.admin?.sourceCollection || f.relationTo}
          sourceField={f.admin?.sourceField || (f.admin?.sourceCollection === 'users' ? 'username' : 'slug')}
          hasMany={hasMany}
          allowCreate={f.admin?.sourceCollection !== 'users'}
        />
       );
    }

    if (f.type === 'select') {
      return <Select {...fieldProps} options={f.options || []} size={FieldSize.SM} />;
    }

    if (f.type === 'boolean' || f.type === 'checkbox') {
        const checked = val === true || val === 'true' || val === 1 || val === '1'
          || ((val === undefined || val === null) && (f.defaultValue === true || f.defaultValue === 'true'));
        return (
            <BooleanToggleField
                checked={checked}
                onChange={(next) => onUpdateItem(index, f.name, next)}
                disabled={Boolean(f.admin?.readOnly)}
                theme={theme}
            />
        );
    }

    if (f.type === 'number') {
      const numAdmin = (f.admin || {}) as Record<string, any>;
      return (
        <NumberStepper
          value={val}
          onChange={(next) => onUpdateItem(index, f.name, next)}
          disabled={Boolean(f.admin?.readOnly)}
          placeholder={fieldProps.placeholder}
          step={numAdmin.step}
          min={numAdmin.min}
          max={numAdmin.max}
          size={FieldSize.SM}
        />
      );
    }

    return (
      <Input
        {...fieldProps}
        type="text"
        size={FieldSize.SM}
      />
    );
  }
}
