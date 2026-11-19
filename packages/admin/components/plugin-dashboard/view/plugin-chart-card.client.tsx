import { SectionCard } from '@/components/plugin-dashboard/view/section-card.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

export class PluginChartCard extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare actions?: ReactNode;
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare noPadding?: boolean;

  /** A chart in the console's card: the same card every other section of a dashboard uses. */
  render(): ReactNode {
    return <SectionCard title={this.title} subtitle={this.subtitle} actions={this.actions} className={this.className}>{this.children}</SectionCard>;
  }
}
