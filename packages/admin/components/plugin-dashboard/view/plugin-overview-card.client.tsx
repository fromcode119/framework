import { StatCard } from '@/components/ui/view/stat-card.client';
import type { IPluginOverviewCardTrend } from '@/components/plugin-dashboard/interfaces/plugin-overview-card-trend.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

export class PluginOverviewCard extends PureReactor {
  @prop declare title: string;
  @prop declare value: string | number;
  @prop declare icon?: ReactNode;
  @prop declare trend?: IPluginOverviewCardTrend;
  @prop declare subtitle?: string;
  @prop declare onClick?: () => void;
  @prop declare className?: string;

  /** The console's own stat tile: the same figure a dashboard shows, wherever a plugin shows one. */
  render(): ReactNode {
    const note = [this.subtitle, this.trend?.label].filter(Boolean).join(' · ');
    return <StatCard title={this.title} value={String(this.value)} icon={this.icon} note={note || undefined} trend={this.trend} onClick={this.onClick} />;
  }
}
