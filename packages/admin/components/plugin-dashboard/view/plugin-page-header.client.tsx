import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

/**
 * Header for plugin admin pages — a thin adapter over the shared {@link CompactPageHeader} so plugin
 * pages get the exact same compact header as the rest of the admin. The negative-margin wrapper lets
 * the sticky bar break out of the plugin dashboard's `p-8` content padding to span full width.
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
      <div className="-mx-8 -mt-8 mb-6">
        <CompactPageHeader
          icon={icon}
          title={badge ? <span className="flex items-center gap-2">{title}{badge}</span> : title}
          subtitle={subtitle}
          actions={actions}
        />
      </div>
    );
  }
}
