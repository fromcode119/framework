import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * Who or what a row is about, as a small round picture — or its initial when there is no picture, or
 * the picture does not load. Six sizes, from the 16px beside a name in a line to the 44px on a
 * profile; a row of them uses one. The look is `admin.css` (`fc-avatar`).
 */
export class Avatar extends PureReactor {
  @prop declare src?: string;
  /** The initial (or two) shown without a picture. */
  @prop declare fallback: string;
  @prop declare size?: '2xsmall' | 'xsmall' | 'small' | 'base' | 'large' | 'xlarge';
  @prop declare alt?: string;
  @prop declare className?: string;

  @state private broken = false;

  @bound private onError(): void {
    this.broken = true;
  }

  render(): ReactNode {
    const name = AdminClass.of('avatar');
    const picture = this.src && !this.broken;
    return (
      <span className={`${name} ${this.className ?? ''}`} data-size={this.size || 'base'}>
        {picture
          ? <img className={`${name}__image`} src={this.src} alt={this.alt ?? ''} onError={this.onError} />
          : <span className={`${name}__fallback`} aria-label={this.alt}>{this.fallback}</span>}
      </span>
    );
  }
}
