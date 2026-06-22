import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { CustomFieldErrorBoundary } from './custom-field-error-boundary';
import type { FieldCustomComponentProps } from './field-renderer.interfaces';

export class FieldCustomComponent extends React.Component<FieldCustomComponentProps> {
  render(): React.ReactNode {
    const {
      field, currentValue, updateValue, theme, collectionSlug, pluginSettings, globalSettings,
      fieldComponents, isFieldReadOnly, record, onPatch, wrapWithReadOnlyOverride
    } = this.props;
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
