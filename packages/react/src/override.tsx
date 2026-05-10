"use client";

import React from 'react';
import { OverridesContext } from './context/overrides-context';
import type { OverrideProps } from './override.interfaces';

export class Override extends React.Component<OverrideProps> {
  render(): React.ReactNode {
    return (
      <OverridesContext.Context.Consumer>
        {(overrides) => {
          const item = overrides[this.props.name];
          const normalizedContent = React.Children.toArray(this.props.children ?? this.props.fallback);

          if (!item?.component) return <>{normalizedContent}</>;

          if (!Override.isValidComponent(item.component)) {
            console.warn(`[Override] Component for override "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
            return <>{normalizedContent}</>;
          }

          try {
            return React.createElement(item.component, {
              ...this.props.props,
              key: `${item.pluginSlug}-${this.props.name}`,
            }, normalizedContent);
          } catch (error) {
            console.error(`[Override] Runtime error in override component "${this.props.name}":`, error);
            return <>{normalizedContent}</>;
          }
        }}
      </OverridesContext.Context.Consumer>
    );
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
