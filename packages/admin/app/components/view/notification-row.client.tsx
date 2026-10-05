import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CoercionUtils } from '@fromcode119/core/client';
import { NotificationTime } from '@/lib/notification-time';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One notification: what it is called, when it happened and, under it, what it says.
 *
 * Opening a row reads the whole message in place and marks it read. A message that carries a link in
 * the console also gets an Open button; one that does not (a health alert, say) still answers a click,
 * which a menu row that did nothing never did.
 */
export class NotificationRow extends PureReactor {
  @prop declare notification: Record<string, any>;
  @prop declare expanded: boolean;
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
      <div className="pb-3.5 pl-9 pr-4">
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          {CoercionUtils.toString(notification.body)}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[11px] text-slate-400 dark:text-slate-500">
            {[NotificationTime.absolute(notification.createdAt), source].filter(Boolean).join(', ')}
          </p>
          {this.link ? (
            <button type="button" onClick={this.follow}
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              {AdminI18n.t('shell.notifications.open')}
              <FrameworkIcons.ArrowRight size={12} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { notification, expanded, unread } = this;
    const body = CoercionUtils.toString(notification.body);
    return (
      <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
        <button type="button" aria-expanded={expanded} onClick={this.toggle}
          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-indigo-600' : 'bg-transparent'}`} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className={`text-[13px] leading-snug ${unread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                {CoercionUtils.toString(notification.title)}
              </span>
              <time dateTime={CoercionUtils.toString(notification.createdAt)} title={NotificationTime.absolute(notification.createdAt)}
                className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                {NotificationTime.relative(notification.createdAt)}
              </time>
            </span>
            {!expanded && body ? (
              <span className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{body}</span>
            ) : null}
          </span>
        </button>
        {expanded ? this.detail : null}
      </div>
    );
  }
}
