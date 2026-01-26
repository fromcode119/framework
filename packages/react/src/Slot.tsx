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
      {components.map((item, index) => (
        <item.component key={`${item.pluginSlug}-${index}`} {...props} />
      ))}
    </>
  );
};
