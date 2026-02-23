"use client";

import React from 'react';
import { FrameworkIcons, getIcon } from '@fromcode119/react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}

/**
 * Generic Icon component that uses the framework's semantic icon set.
 * Falls back to dynamic lookup if not found in the semantic set.
 */
export const Icon = ({ name, ...props }: IconProps) => {
  if (!name) return <FrameworkIcons.Package {...props} />;
  
  // Normalize name to PascalCase for searching
  const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

  // 1. Try to find the icon in the framework's semantic library
  const SemanticIcon = (FrameworkIcons as any)[name] || (FrameworkIcons as any)[pascalName];
  if (SemanticIcon) {
    return <SemanticIcon {...props} />;
  }

  // 2. Fallback to dynamic lookup from the registry (Lucide, etc)
  const DynamicIcon = getIcon(name);
  if (DynamicIcon) {
    return <DynamicIcon {...props} />;
  }

  // 3. Final fallback to 'Package'
  const Fallback = FrameworkIcons.Package;
  if (Fallback) return <Fallback {...props} />;
  
  return <span className="w-4 h-4 bg-slate-200 rounded-sm animate-pulse inline-block" />;
};
