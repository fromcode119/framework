import { ThemeMode } from '@fromcode119/core/client';
import React from 'react';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { CustomFieldErrorBoundary } from '@/components/collection/custom-field-error-boundary';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
export class FieldCustomComponent extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare currentValue: any;
  @prop declare updateValue: (value: any) => void;
  @prop declare theme: ThemeMode;
  @prop declare collectionSlug: string;
  @prop declare pluginSettings?: Record<string, any>;
  @prop declare globalSettings?: Record<string, any>;
  @prop declare fieldComponents: Record<string, any>;
  @prop declare isFieldReadOnly: boolean;
  @prop declare record?: Record<string, any>;
  @prop declare onPatch?: (partial: Record<string, any>) => void;
  @prop declare wrapWithReadOnlyOverride: (node: ReactNode, roundedClass?: string) => ReactNode;

  render(): ReactNode {
    const {
      field, currentValue, updateValue, theme, collectionSlug, pluginSettings, globalSettings,
      fieldComponents, isFieldReadOnly, record, onPatch, wrapWithReadOnlyOverride
    } = this;
    const componentName = field.admin!.component as string;
    const registeredComponent = fieldComponents[componentName];
    let CustomComponent: any = registeredComponent;

    if (registeredComponent && typeof registeredComponent === 'object' && !registeredComponent.$$typeof) {
      CustomComponent =
        registeredComponent.component ||
        registeredComponent.Component ||
        registeredComponent.render ||
        registeredComponent.default ||
        registeredComponent;
    }

    const canRenderComponent =
      Boolean(CustomComponent) &&
      (typeof CustomComponent === 'function' || typeof CustomComponent === 'string');

    if (canRenderComponent) {
      try {
        const customNode = React.createElement(CustomComponent, {
          value: currentValue,
          onChange: updateValue,
          theme,
          field,
          collectionSlug,
          pluginSettings,
          globalSettings,
          disabled: isFieldReadOnly,
          // Reactive-form props: read all sibling values + patch any of them live.
          record: record || {},
          onPatch: onPatch || (() => {}),
        });

        return wrapWithReadOnlyOverride(
          <CustomFieldErrorBoundary componentName={componentName}>
            {customNode}
          </CustomFieldErrorBoundary>
        );
      } catch (error) {
        console.error(`[FieldRenderer] Failed to render custom component "${componentName}"`, error);
      }
    }

    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2">
        <FrameworkIcons.Alert size={12} />
        Component "{componentName}" not registered by any plugin.
      </div>
    );
  }
}
