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
      <div className="pb-3.5 ps-9 pe-4">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {CoercionUtils.toString(notification.body)}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[12px] text-slate-400 dark:text-slate-500">
            {[NotificationTime.absolute(notification.createdAt), source].filter(Boolean).join(', ')}
          </p>
          {this.link ? (
            <button type="button" onClick={this.follow}
              className="inline-flex shrink-0 items-center gap-1 text-[length:var(--fc-control-text)] font-medium text-[color:var(--primary)] transition-[filter] hover:brightness-90">
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
      <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
        <button type="button" onClick={this.toggle}
          className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-[color:var(--primary)]' : 'bg-transparent'}`} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className={`text-[13px] leading-snug ${unread ? 'font-medium text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                {CoercionUtils.toString(notification.title)}
              </span>
              <time dateTime={CoercionUtils.toString(notification.createdAt)} title={NotificationTime.absolute(notification.createdAt)}
                className="shrink-0 text-[12px] tabular-nums text-slate-400 dark:text-slate-500">
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
