"use client";

import React from 'react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';

interface PluginPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  subtitleClassName?: string;
  titleClassName?: string;
}

/**
 * Header for plugin admin pages — a thin adapter over the shared {@link CompactPageHeader} so plugin
 * pages get the exact same compact header as the rest of the admin. The negative-margin wrapper lets
 * the sticky bar break out of the plugin dashboard's `p-8` content padding to span full width.
 */
export class PluginPageHeader extends React.Component<PluginPageHeaderProps> {
  render(): React.ReactNode {
    const { title, subtitle, icon, actions, badge } = this.props;
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
