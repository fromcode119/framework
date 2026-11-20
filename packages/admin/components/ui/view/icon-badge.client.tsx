import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** An icon in a small tinted square: what kind of thing a row or a card is, at a glance. */
export class IconBadge extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  @prop declare size?: 'base' | 'large';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('icon-badge');
    return <span className={`${name} ${name}--${this.size ?? 'base'} ${this.className ?? ''}`} data-tone={this.tone ?? 'neutral'}>{this.children}</span>;
  }
}
