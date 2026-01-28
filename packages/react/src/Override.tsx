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

  if (!item) {
    return <>{fallback || children}</>;
  }

  const Component = item.component;
  return <Component {...props}>{children || fallback}</Component>;
};
