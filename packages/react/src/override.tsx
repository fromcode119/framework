"use client";

import React from 'react';
import { PluginsProvider } from './context';
import type { PluginContextValue } from './context.interfaces';
import type { OverrideProps } from './override.interfaces';

export class Override extends React.Component<OverrideProps> {
  static contextType = PluginsProvider.PluginContext;

  declare context: PluginContextValue | null;

  render(): React.ReactNode {
    const item = this.context?.overrides[this.props.name];
    const normalizedContent = this.getNormalizedContent();

    if (!item?.component) {
      return <>{normalizedContent}</>;
    }

    if (!Override.isValidComponent(item.component)) {
      console.warn(`[Override] Component for override "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
      return <>{normalizedContent}</>;
    }

    try {
      return React.createElement(item.component, {
        ...this.props.props,
        key: `${item.pluginSlug}-${this.props.name}`
      }, normalizedContent);
    } catch (error) {
      console.error(`[Override] Runtime error in override component "${this.props.name}":`, error);
      return <>{normalizedContent}</>;
    }
  }

  private getNormalizedContent(): React.ReactNode {
    return React.Children.toArray(this.props.children ?? this.props.fallback);
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
