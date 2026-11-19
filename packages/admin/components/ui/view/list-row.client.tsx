import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Avatar } from '@/components/ui/view/avatar.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One row of a `ListCard`: something installed, someone, a role — what it is, the state it is in, a
 * line about it, a quiet fact at the end, and what can be done to it.
 *
 * `icon` is a glyph or a picture; `initials` draws the console's `Avatar` for a person instead. `badges`
 * are `Badge`s. `menu` is the list of a "more" menu, drawn with the console's own trigger — a row does
 * not bring its own three dots.
 */
export class ListRow extends PureReactor {
  /** What stands before the icon: a tick, when rows can be chosen. */
  @prop declare lead?: ReactNode;
  @prop declare icon?: ReactNode;
  @prop declare initials?: string;
  @prop declare title: ReactNode;
  @prop declare badges?: ReactNode;
  @prop declare description?: ReactNode;
  /** The whole line, for a tooltip when it is cut. */
  @prop declare descriptionTitle?: string;
  /** The line under the name is an error. */
  @prop declare failed?: boolean;
  @prop declare meta?: string;
  @prop declare actions?: ReactNode;
  @prop declare menu?: any[];

  render(): ReactNode {
    const row = AdminClass.of('ext-row');
    return (
      <div className={row}>
        {this.lead ? <div className={`${row}__lead`}>{this.lead}</div> : null}
        {this.initials
          ? <Avatar fallback={this.initials} />
          : this.icon ? <div className={`${row}__icon`}>{this.icon}</div> : null}
        <div className={`${row}__text`}>
          <div className={`${row}__name`}>
            {this.title}
            {this.badges}
          </div>
          {this.description
            ? <p className={`${row}__desc${this.failed ? ` ${row}__desc--error` : ''}`} title={this.descriptionTitle}>{this.description}</p>
            : null}
        </div>
        {this.meta ? <div className={`${row}__meta`} title={this.meta}>{this.meta}</div> : null}
        {this.actions || this.menu?.length ? (
          <div className={`${row}__actions`}>
            {this.actions}
            {this.menu?.length ? (
              <Dropdown align={HorizontalAlign.RIGHT} items={this.menu} trigger={
                <span aria-label={AdminI18n.t('common.more')} className={`${row}__more`}><FrameworkIcons.More size={16} /></span>
              } />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
}
