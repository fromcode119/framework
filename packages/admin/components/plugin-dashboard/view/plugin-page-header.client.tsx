import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

/**
 * Header for plugin admin pages — a thin adapter over the shared {@link CompactPageHeader} so plugin
 * pages get the exact same compact header as the rest of the admin. `AdminClass.PAGE_BLEED` lets the
 * sticky bar span the full content column; the offset is NOT written here, because the padding being
 * cancelled belongs to the plugin's page root (p-4 … p-8, they differ) and not to this component —
 * see the `.fc-page-bleed` block in admin.css.
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
      <div className={AdminClass.PAGE_BLEED}>
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
