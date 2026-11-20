import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A tip inside a form or a card: a coloured bar, a strong word, then a sentence or two. It explains
 * the fields beside it — for something about the whole page, use Alert.
 */
export class InlineTip extends PureReactor {
  @prop declare children: ReactNode;
  /** The strong word the tip starts with: "Tip", "Warning". */
  @prop declare label: ReactNode;
  @prop declare variant?: 'info' | 'success' | 'warning' | 'error';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('inline-tip');
    return (
      <div className={`${name} ${this.className ?? ''}`} data-tone={this.variant ?? 'info'}>
        <span className={`${name}__bar`} role="presentation" />
        <p className={`${name}__text`}><strong>{this.label}:</strong> {this.children}</p>
      </div>
    );
  }
}
