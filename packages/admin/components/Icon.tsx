"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}

/**
 * Generic Icon component that uses the framework's semantic icon set.
 * Falls back to the 'Package' icon if the specified name is not found.
 */
export const Icon = ({ name, ...props }: IconProps) => {
  // Try to find the icon in the framework's semantic library
  const TargetIcon = (FrameworkIcons as any)[name];

  if (!TargetIcon) {
    // If not found, try 'Package' as a default fallback
    const Fallback = FrameworkIcons.Package;
    if (Fallback) return <Fallback {...props} />;
    return <span className="w-4 h-4 bg-slate-200 rounded-sm animate-pulse inline-block" />;
  }

  return <TargetIcon {...props} />;
};
