import type { CSSProperties, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

/** The open/closed caret on the locale chip; rotates 180° when the menu is open. */
export class ChevronIcon extends PureReactor {
  @prop declare open: boolean;
  @prop declare size?: number;

  private get resolvedSize(): number {
    return this.size ?? 9;
  }

  private get style(): CSSProperties {
    return {
      transform: this.open ? 'rotate(180deg)' : 'none',
      transition: 'transform 0.15s ease',
    };
  }

  render(): ReactNode {
    const size = this.resolvedSize;
    return (
      <svg width={size} height={size} viewBox="0 0 12 8" fill="none" aria-hidden="true" style={this.style}>
        <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
}
