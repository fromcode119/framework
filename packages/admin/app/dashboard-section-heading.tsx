import { Heading } from '@/components/ui/view/heading.client';
import { Badge } from '@/components/ui/view/badge.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * The label above a group of rows.
 *
 * It used to be an indigo tick, a small-caps label, a hairline rule stretched across the page and a
 * right-aligned count — four devices to say one word. At dashboard scale the rules read as table
 * borders and the ticks as status lights, so the page looked like it was reporting something in
 * every gap between panels.
 *
 * A quiet label and the space above it are enough to separate two groups; the count, when there is
 * one, sits next to the word it counts rather than at the far end of a rule.
 */
export class DashboardSectionHeading extends PureReactor {
  @prop declare label: string;
  @prop declare count?: ReactNode;

  render(): ReactNode {
    return (
      <div className="fc-chip-row">
        <Heading level="h3">{this.label}</Heading>
        {this.count !== undefined && this.count !== null && this.count !== '' ? <Badge>{this.count}</Badge> : null}
      </div>
    );
  }
}
