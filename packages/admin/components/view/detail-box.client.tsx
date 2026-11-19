import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';

/**
 * One titled part of a detail page's Overview (a plugin, a theme): the kit's record card, with the
 * part's own control at the end of its head.
 */
export class DetailBox extends PureReactor {
  @prop declare title: string;
  /** Accepted for backward-compat and ignored — the look comes from the kit. */
  @prop declare theme?: ThemeMode;
  @prop declare action?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    return (
      <RecordCard title={this.title} className={this.className} aside={this.action ? <div className="fc-record-card__table-tools">{this.action}</div> : undefined}>
        {this.children}
      </RecordCard>
    );
  }
}
