import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

/** The globe glyph on the locale chip. Inline SVG so it needs no icon-font or sprite. */
export class GlobeIcon extends PureReactor {
  @prop declare size?: number;
  @prop declare color?: string;

  private get resolvedSize(): number {
    return this.size ?? 11;
  }

  private get resolvedColor(): string {
    return this.color ?? 'currentColor';
  }

  render(): ReactNode {
    const size = this.resolvedSize;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={this.resolvedColor}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z" />
      </svg>
    );
  }
}
