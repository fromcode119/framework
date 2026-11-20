import { StatCard as Tile } from '@/components/ui/view/stat-card.client';
import type { IStatItem } from '@/components/plugin-dashboard/interfaces/stat-item.interface';
import { StatColor } from '@/components/plugin-dashboard/enums/stat-color.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/** A plugin's figure, drawn with the console's own stat tile so it looks like every other one. */
export class StatCard extends PureReactor {
  @prop declare stat: IStatItem;

  /** The plugin's colour word as the tile's tone; `primary` is the quiet default. */
  private get tone(): Tile['tone'] {
    const color = StatColor.resolve(this.stat.color).value;
    return color === 'success' || color === 'warning' || color === 'danger' || color === 'info' ? color : undefined;
  }

  render(): ReactNode {
    const stat = this.stat;
    return <Tile title={stat.label} value={String(stat.value)} icon={stat.icon} note={stat.subtext} tone={this.tone} trend={stat.trend} href={stat.href} />;
  }
}
