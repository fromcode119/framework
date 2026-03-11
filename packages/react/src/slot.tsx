"use client";

import React from 'react';
import { PluginsProvider } from './context';
import type { PluginContextValue, SlotComponent } from './context.interfaces';
import type { SlotProps } from './slot.interfaces';

export class Slot extends React.Component<SlotProps> {
  static contextType = PluginsProvider.PluginContext;

  declare context: PluginContextValue | null;

  render(): React.ReactNode {
    const components = this.context?.slots[this.props.name] || [];
    if (components.length === 0) {
      return <>{this.props.fallback}</>;
    }

    return <>{components.map(this.renderSlotComponent.bind(this))}</>;
  }

  private renderSlotComponent(item: SlotComponent, index: number): React.ReactNode {
    if (!item?.component) {
      console.warn(`[Slot] Requested component for slot "${this.props.name}" is undefined. Plugin: ${item?.pluginSlug || 'unknown'}`);
      return null;
    }

    if (!Slot.isValidComponent(item.component)) {
      console.warn(`[Slot] Component for slot "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
      return null;
    }

    try {
      return React.createElement(item.component, {
        key: `${item.pluginSlug}-${index}`,
        ...this.props.props,
      });
    } catch (error) {
      console.error(`[Slot] Runtime error in slot component "${this.props.name}":`, error);
      return null;
    }
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
