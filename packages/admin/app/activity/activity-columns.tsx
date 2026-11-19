import type { ReactElement } from 'react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ActivityMessage } from '@/app/activity/activity-message';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Avatar } from '@/components/ui/view/avatar.client';

/**
 * The columns of the activity log, system and security alike.
 *
 * One line a row, like every list in the console: the state as a {@link StateBadge}, what happened in
 * the column that takes the width left over (cut with an ellipsis, never pushing the table sideways),
 * who, where and when. The entry's own number and the actor's id are in the entry's detail, which the
 * row opens — printed under every cell they made each row two lines of mostly the same words.
 */
export class ActivityColumnsFactory {
  /** ERROR is danger, WARN is warning, everything else is a thing that worked. */
  private static levelTone(level: string): string {
    const value = String(level || '').toUpperCase();
    if (value === 'ERROR') return 'danger';
    if (value === 'WARN') return 'warning';
    return 'success';
  }

  /** A violation is danger, a refusal is warning, everything else is a thing that was allowed. */
  private static statusTone(status: string): string {
    const value = String(status || '').toLowerCase();
    if (value === 'violation') return 'danger';
    if (value === 'denied') return 'warning';
    return 'success';
  }

  private static named(row: any): string {
    const slug = String(row.pluginSlug || '');
    if (!slug || slug === 'system') return AdminI18n.t('activity.system');
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  private static who(name: string): ReactElement {
    return (
      <span className="fc-dt-who">
        <Avatar fallback={(name || '?')[0]?.toUpperCase() || '?'} size="xsmall" />
        <span>{name}</span>
      </span>
    );
  }

  private static when(value: string | number | Date): string {
    return new Date(value).toLocaleString(AdminI18n.locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  static system() {
    return [
      {
        header: AdminI18n.t('activity.event'),
        id: 'event',
        accessor: (row: any) => (
          <StateBadge tone={ActivityColumnsFactory.levelTone(row.level)}>
            {AdminI18n.optional(`activity.level.${String(row.level || '').toUpperCase()}`) || row.level}
          </StateBadge>
        ),
      },
      {
        header: AdminI18n.t('activity.activity'),
        id: 'details',
        className: 'fc-dt-fill',
        accessor: (row: any) => ActivityMessage.of(row),
      },
      {
        header: AdminI18n.t('activity.actor'),
        id: 'actor',
        // The entry says who it was. It used to be cut out of the message — `message.split('for ')[1]`
        // — which only ever worked while that message was an English sentence.
        accessor: (row: any) => ActivityColumnsFactory.who(String(row.actor_id || row.context?.email || AdminI18n.t('activity.system'))),
      },
      {
        header: AdminI18n.t('activity.resource'),
        id: 'target',
        accessor: (row: any) => ActivityColumnsFactory.named(row),
      },
      {
        header: AdminI18n.t('activity.time'),
        id: 'timestamp',
        accessor: (row: any) => ActivityColumnsFactory.when(row.timestamp || row.createdAt),
      },
    ];
  }

  static security() {
    return [
      {
        header: AdminI18n.t('activity.status'),
        id: 'status',
        accessor: (row: any) => (
          <StateBadge tone={ActivityColumnsFactory.statusTone(row.status)}>
            {AdminI18n.optional(`activity.status.${String(row.status || '').toLowerCase()}`) || row.status}
          </StateBadge>
        ),
      },
      {
        header: AdminI18n.t('activity.action'),
        id: 'action',
        accessor: (row: any) => row.action,
      },
      {
        header: AdminI18n.t('activity.resource'),
        id: 'resource',
        className: 'fc-dt-fill',
        accessor: (row: any) => row.resource,
      },
      {
        header: AdminI18n.t('activity.plugin'),
        id: 'plugin',
        accessor: (row: any) => ActivityColumnsFactory.who(ActivityColumnsFactory.named(row)),
      },
      {
        header: AdminI18n.t('activity.time'),
        id: 'timestamp',
        accessor: (row: any) => ActivityColumnsFactory.when(row.createdAt),
      },
    ];
  }
}
