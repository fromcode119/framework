import type { IStatItem } from '@/components/plugin-dashboard/interfaces/stat-item.interface';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { StatCard } from '@/components/plugin-dashboard/view/stat-card.client';

export class PluginStatsList extends PureReactor {
  private static readonly gridCols: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  @prop declare stats: IStatItem[];
  @prop declare columns?: 2 | 3 | 4 | 5 | 6;
  @prop declare className?: string;

  render(): ReactNode {
    const columns = this.columns ?? 3;
    const className = this.className ?? '';
    return (
      <div className={`grid ${PluginStatsList.gridCols[columns] || PluginStatsList.gridCols[4]} gap-3 ${className}`}>
        {this.stats.map((stat, index) => (
          <StatCard key={index} stat={stat} />
        ))}
      </div>
    );
  }
}
