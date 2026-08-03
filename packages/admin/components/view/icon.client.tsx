import type { IIconProps } from '@/components/interfaces/icon-props.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * Generic Icon component. Resolves from the framework semantic icon set with Lucide fallback.
 * Pure presentational class.
 */
export class Icon extends PureReactor {
  @prop declare name: string;

  render(): ReactNode {
    const { name, ...props } = this.props as IIconProps;
    if (!name) return <FrameworkIcons.Package {...props} />;

    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
    const SemanticIcon = (FrameworkIcons as any)[name] || (FrameworkIcons as any)[pascalName];
    if (SemanticIcon) return <SemanticIcon {...props} />;

    const DynamicIcon = FrameworkIcons.getIcon(name);
    if (DynamicIcon) return <DynamicIcon {...props} />;

    const Fallback = FrameworkIcons.Package;
    if (Fallback) return <Fallback {...props} />;

    return <span className="w-4 h-4 bg-slate-200 rounded-lg animate-pulse inline-block" />;
  }
}
