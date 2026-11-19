import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

export class StatCard extends PureReactor {
  @prop declare title: string;
  @prop declare value: string;
  @prop declare icon?: ReactNode;
  /** One line under the figure: what it counts, over what time. */
  @prop declare note?: ReactNode;
  /** The colour of the icon when the figure is good or bad news; quiet when left out. */
  @prop declare tone?: 'success' | 'warning' | 'danger' | 'info';
  @prop declare trend?: {
    value: number;
    isPositive: boolean;
  };

  render(): ReactNode {
    const { title, value, icon, trend, note } = this;
    // The label, the number and the icon in the console's own ink. The tile was indigo and the trend a
    // literal green or red, on a card that follows the scheme in every other respect.
    const stat = AdminClass.of('stat');
    return (
      <div className={`${AdminClass.SURFACE} ${stat}`}>
        <div className={`${stat}__top`}>
          <span className={`${stat}__label`}>{title}</span>
          {icon ? <span className={`${stat}__icon`} data-tone={this.tone} aria-hidden="true">{icon}</span> : null}
        </div>
        <div className={`${stat}__bottom`}>
          <span className={`${stat}__value`}>{value}</span>
          {trend ? <span className={`${stat}__trend`} data-up={trend.isPositive ? 'true' : 'false'}>{trend.isPositive ? '↑' : '↓'} {trend.value}%</span> : null}
        </div>
        {note ? <p className={`${stat}__note`}>{note}</p> : null}
      </div>
  );
  }
}
