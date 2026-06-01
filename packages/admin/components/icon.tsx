"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}

/**
 * Generic Icon component. Resolves from the framework semantic icon set with Lucide fallback.
 * Pure presentational class.
 */
export class Icon extends React.Component<IconProps> {
  render(): React.ReactNode {
    const { name, ...props } = this.props;
    if (!name) return <FrameworkIcons.Package {...props} />;

    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
    const SemanticIcon = (FrameworkIcons as any)[name] || (FrameworkIcons as any)[pascalName];
    if (SemanticIcon) return <SemanticIcon {...props} />;

    const DynamicIcon = FrameworkIcons.getIcon(name);
    if (DynamicIcon) return <DynamicIcon {...props} />;

    const Fallback = FrameworkIcons.Package;
    if (Fallback) return <Fallback {...props} />;

    return <span className="w-4 h-4 bg-slate-200 rounded-sm animate-pulse inline-block" />;
  }
}
