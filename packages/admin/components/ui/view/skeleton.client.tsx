import type { CSSProperties, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * The shape of something that is still loading, standing where it will stand: a line where a title
 * will be, a block where a card will be. It keeps the page from jumping when the content arrives,
 * which a spinner in the middle of an empty page does not. Give it the size of what it stands for.
 */
export class Skeleton extends PureReactor {
  @prop declare width?: number | string;
  @prop declare height?: number | string;
  /** Round, for where an avatar will be. */
  @prop declare round?: boolean;
  @prop declare className?: string;

  render(): ReactNode {
    const style: CSSProperties = { width: this.width, height: this.height };
    return <span aria-hidden="true" className={`${AdminClass.of('skeleton')} ${this.className ?? ''}`} data-round={this.round ? 'true' : undefined} style={style} />;
  }
}
