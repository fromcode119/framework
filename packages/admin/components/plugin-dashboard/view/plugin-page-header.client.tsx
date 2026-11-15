import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

/**
 * Header for plugin admin pages — a thin adapter over the shared {@link CompactPageHeader} so plugin
 * pages get the exact same compact header as the rest of the admin. Spanning the content column is the
 * header's own business now — see `CompactPageHeader`.
 */
export class PluginPageHeader extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare icon?: ReactNode;
  @prop declare actions?: ReactNode;
  @prop declare badge?: ReactNode;
  @prop declare subtitleClassName?: string;
  @prop declare titleClassName?: string;

  render(): ReactNode {
    const { title, subtitle, icon, actions, badge } = this;
    return (
      <CompactPageHeader
        icon={icon}
        title={badge ? <span className="flex items-center gap-2">{title}{badge}</span> : title}
        subtitle={subtitle}
        actions={actions}
      />
    );
  }
}
