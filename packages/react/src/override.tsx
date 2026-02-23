"use client";

import React from 'react';
import { usePlugins } from './context';

interface OverrideProps {
  name: string;
  props?: Record<string, any>;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

export const Override = ({ name, props, fallback, children }: OverrideProps) => {
  const { overrides } = usePlugins();
  const item = overrides[name];

  if (!item || !item.component) {
    return <>{fallback || children}</>;
  }

  const Component = item.component;

  // Safety check for React component validity
  if (typeof Component !== 'function' && typeof Component !== 'string' && !(Component as any)?.$$typeof) {
    console.warn(`[Override] Component for override "${name}" is of invalid type: ${typeof Component}. Skipping.`);
    return <>{fallback || children}</>;
  }

  try {
    return <Component {...props}>{children || fallback}</Component>;
  } catch (err) {
    console.error(`[Override] Runtime error in override component "${name}":`, err);
    return <>{fallback || children}</>;
  }
};
