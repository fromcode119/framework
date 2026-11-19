import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { Text } from '@/components/ui/view/text.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

export class SectionCard extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare icon?: ReactNode;
  @prop declare actions?: ReactNode;
  @prop declare children: ReactNode;
  @prop declare noPadding?: boolean;
  @prop declare className?: string;
  /** Show the subtitle as the title's hint instead of a second line (dense surfaces such as the dashboard). */
  @prop declare subtitleAsHint?: boolean;

  /**
   * The console's own cards, not a card of its own: a list that draws its rows edge to edge is the
   * list card, anything else is the record card — so a plugin's dashboard has the same head, the same
   * insets and the same corner as every other screen. `icon` is accepted and not drawn: the console's
   * card heads carry a name and what stands beside it, never a tile.
   */
  render(): ReactNode {
    const { title, subtitle, actions, children } = this;
    const line = subtitle && !this.subtitleAsHint ? subtitle : undefined;
    if (this.noPadding) {
      return <ListShell title={title} subtitle={line} actions={actions} className={this.className}>{children}</ListShell>;
    }
    return (
      <RecordCard title={title} aside={actions} className={this.className}>
        <div className="fc-stack">
          {line ? <Text size="small" muted as="p">{line}</Text> : null}
          {children}
        </div>
      </RecordCard>
    );
  }
}
