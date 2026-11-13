import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A record's state in a word, with a dot in the state's tone: "● Paid", "● Unfulfilled". The tone is the
 * one a select option declares (`success`, `warning`, `danger`, `info`; anything else is neutral), so a
 * badge in a header, a card or a plugin's panel reads the same. The look is `admin.css` (`fc-state-badge`).
 */
export class StateBadge extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare tone?: string;

  render(): ReactNode {
    return <span className={AdminClass.of('state-badge')} data-tone={this.tone || 'default'}>{this.children}</span>;
  }
}
