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
    if (!item?.component) {
      return <>{this.props.fallback || this.props.children}</>;
    }

    if (!Override.isValidComponent(item.component)) {
      console.warn(`[Override] Component for override "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
      return <>{this.props.fallback || this.props.children}</>;
    }

    try {
      return React.createElement(item.component, this.props.props, this.props.children || this.props.fallback);
    } catch (error) {
      console.error(`[Override] Runtime error in override component "${this.props.name}":`, error);
      return <>{this.props.fallback || this.props.children}</>;
    }
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
