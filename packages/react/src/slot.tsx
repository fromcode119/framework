"use client";

import React from 'react';
import { usePlugins } from './context';

interface SlotProps {
  name: string;
  props?: Record<string, any>;
  fallback?: React.ReactNode;
}

export const Slot = ({ name, props, fallback }: SlotProps) => {
  const { slots } = usePlugins();
  const components = slots[name] || [];

  if (components.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <>
      {components.map((item, index) => {
        if (!item || !item.component) {
          console.warn(`[Slot] Requested component for slot "${name}" is undefined. Plugin: ${item?.pluginSlug || 'unknown'}`);
          return null;
        }
        
        const Component = item.component;
        
        // Final safety check for React component validity
        // Valid types are strings (built-ins) or functions/classes/objects with $$typeof
        if (typeof Component !== 'function' && typeof Component !== 'string' && !(Component as any)?.$$typeof) {
          console.warn(`[Slot] Component for slot "${name}" is of invalid type: ${typeof Component}. Skipping.`);
          return null;
        }

        try {
          return React.createElement(Component, { 
            key: `${item.pluginSlug}-${index}`,
            ...props 
          });
        } catch (err) {
          console.error(`[Slot] Runtime error in slot component "${name}":`, err);
          return null;
        }
      })}
    </>
  );
};
