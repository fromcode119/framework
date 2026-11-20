import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * Something is happening right here, inline: beside a word, inside a badge, in a row's corner.
 *
 * One ring drawn in the colour of the text around it, so it sits in a primary button, a muted line or a
 * badge without a colour of its own. Screens used to spin whatever icon was at hand — a loader glyph, a
 * refresh arrow, once a Play triangle — each at its own size and colour. A block of a page that is
 * still loading is `Loader`; a button that is working is `Button isLoading`.
 */
export class Spinner extends PureReactor {
  declare props: Pick<Spinner, 'small' | 'label' | 'className'>;

  /** 12px instead of 16px, for a badge or a line of small text. */
  @prop declare small?: boolean;
  /** What is happening, for a screen reader; the ring alone says nothing to one. */
  @prop declare label?: string;
  @prop declare className?: string;

  render(): ReactNode {
    return (
      <span
        className={`fc-spinner${this.small ? ' fc-spinner--sm' : ''}${this.className ? ` ${this.className}` : ''}`}
        role={this.label ? 'status' : undefined}
        aria-label={this.label || undefined}
        aria-hidden={this.label ? undefined : true}
      />
    );
  }
}
