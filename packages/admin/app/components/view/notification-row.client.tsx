import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CoercionUtils } from '@fromcode119/core/client';
import { NotificationTime } from '@/lib/notification-time';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One notification: what it is called, when it happened and, under it, what it says.
 *
 * The whole message is on the row. It used to fold: the row showed two clipped lines and a click
 * unfolded the rest in place, so reading three notifications meant opening and closing three times and
 * the list jumped under the pointer each time. A notification is a few lines - it is shown.
 *
 * A click marks it read, and follows its link when it carries one.
 */
export class NotificationRow extends PureReactor {
  @prop declare notification: Record<string, any>;
  /** Reports that the operator has read this one. */
  @prop declare onToggle: (notification: Record<string, any>) => void;
  @prop declare onFollow: (link: string) => void;

  @bound private toggle(): void {
    this.onToggle(this.notification);
  }

  @bound private follow(): void {
    this.onFollow(CoercionUtils.toString(this.notification.link));
  }

  private get unread(): boolean {
    return !this.notification.read;
  }

  private get link(): string {
    const link = CoercionUtils.toString(this.notification.link);
    return link.startsWith('/') ? link : '';
  }

  private get detail(): ReactNode {
    const { notification } = this;
    const source = CoercionUtils.toString(notification.source);
    return (
      <div className="fc-notice__detail">
        <p className="fc-notice__body">
          {CoercionUtils.toString(notification.body)}
        </p>
        <div className="fc-notice__meta">
          <p className="fc-notice__when">
            {[NotificationTime.absolute(notification.createdAt), source].filter(Boolean).join(', ')}
          </p>
          {this.link ? (
            <button type="button" onClick={this.follow}
              className="fc-notice__open">
              {AdminI18n.t('shell.notifications.open')}
              <FrameworkIcons.ArrowRight size={12} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { notification, unread } = this;
    return (
      <div className="fc-notice">
        <button type="button" onClick={this.toggle}
          className="fc-notice__head">
          <span aria-hidden="true" className="fc-notice__dot" data-unread={unread ? 'true' : 'false'} />
          <span className="fc-notice__main">
            <span className="fc-notice__line">
              <span className="fc-notice__title" data-unread={unread ? 'true' : 'false'}>
                {CoercionUtils.toString(notification.title)}
              </span>
              <time dateTime={CoercionUtils.toString(notification.createdAt)} title={NotificationTime.absolute(notification.createdAt)}
                className="fc-notice__ago">
                {NotificationTime.relative(notification.createdAt)}
              </time>
            </span>
          </span>
        </button>
        {this.detail}
      </div>
    );
  }
}
