import type { ReactElement } from 'react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ActivityMessage } from '@/app/activity/activity-message';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';

/**
 * The columns of the activity log, system and security alike.
 *
 * Each row is a name and a time with a state beside it, drawn like every other list in the console:
 * the state is a {@link Badge} in one of the five tones, the rest is the record's own text sizes. It
 * used to pick its colours by hand — `theme === ThemeMode.DARK ? 'bg-rose-500/10 …' : 'bg-rose-50 …'`
 * in six places — print the date at 8px in italics, and mark a plugin with a glowing indigo dot.
 */
export class ActivityColumnsFactory {
  /** ERROR is danger, WARN is warning, everything else is a thing that worked. */
  private static levelTone(level: string): BadgeVariant {
    const value = String(level || '').toUpperCase();
    if (value === 'ERROR') return BadgeVariant.DANGER;
    if (value === 'WARN') return BadgeVariant.WARNING;
    return BadgeVariant.SUCCESS;
  }

  /** A violation is danger, a refusal is warning, everything else is a thing that was allowed. */
  private static statusTone(status: string): BadgeVariant {
    const value = String(status || '').toLowerCase();
    if (value === 'violation') return BadgeVariant.DANGER;
    if (value === 'denied') return BadgeVariant.WARNING;
    return BadgeVariant.SUCCESS;
  }

  /** The initial in a circle, the console's quiet surface — one shape for an actor and for a plugin. */
  private static initial(text: string): ReactElement {
    return <span className="fc-activity__initial">{(text || '?')[0]?.toUpperCase()}</span>;
  }

  private static named(row: any): string {
    const slug = String(row.pluginSlug || '');
    if (!slug || slug === 'system') return AdminI18n.t('activity.system');
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  /** The time above, the day under it — both read, so both at the console's own sizes. */
  private static when(value: string | number | Date): ReactElement {
    const at = new Date(value);
    return (
      <div className="fc-activity__stack">
        <span className="fc-activity__value">{at.toLocaleTimeString(AdminI18n.locale)}</span>
        <span className="fc-activity__quiet">{at.toLocaleDateString()}</span>
      </div>
    );
  }

  static system() {
    return [
      {
        header: AdminI18n.t('activity.event'),
        id: 'event',
        accessor: (row: any) => (
          <div className="fc-activity__stack">
            <Badge variant={ActivityColumnsFactory.levelTone(row.level)}>
              {AdminI18n.optional(`activity.level.${String(row.level || '').toUpperCase()}`) || row.level}
            </Badge>
            <span className="fc-activity__quiet">
              {String(row.id).includes('-') ? String(row.id).split('-')[0] : `LOG-${row.id}`}
            </span>
          </div>
        ),
      },
      {
        header: AdminI18n.t('activity.actor'),
        id: 'actor',
        accessor: (row: any) => {
          // The entry says who it was. It used to be cut out of the message — `message.split('for ')[1]`
          // — which only ever worked while that message was an English sentence.
          const actor = row.actor_id || row.context?.email || AdminI18n.t('activity.system');
          return (
            <div className="fc-activity__who">
              {ActivityColumnsFactory.initial(actor)}
              <div className="fc-activity__stack">
                <span className="fc-activity__value">{actor}</span>
                <span className="fc-activity__quiet">
                  {row.actor_id
                    ? `ID: ${row.actor_id}`
                    : (row.context?.userId ? `UID: ${row.context.userId}` : AdminI18n.t('activity.internal'))}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        header: AdminI18n.t('activity.resource'),
        id: 'target',
        accessor: (row: any) => <span className="fc-activity__value">{ActivityColumnsFactory.named(row)}</span>,
      },
      {
        header: AdminI18n.t('activity.timestamp'),
        id: 'timestamp',
        accessor: (row: any) => ActivityColumnsFactory.when(row.timestamp || row.createdAt),
      },
      {
        header: AdminI18n.t('activity.activity'),
        id: 'details',
        accessor: (row: any) => <span className="fc-activity__message">{ActivityMessage.of(row)}</span>,
      },
    ];
  }

  static security() {
    return [
      {
        header: AdminI18n.t('activity.status'),
        id: 'status',
        accessor: (row: any) => (
          <Badge variant={ActivityColumnsFactory.statusTone(row.status)}>
            {AdminI18n.optional(`activity.status.${String(row.status || '').toLowerCase()}`) || row.status}
          </Badge>
        ),
      },
      {
        header: AdminI18n.t('activity.plugin'),
        id: 'plugin',
        accessor: (row: any) => (
          <div className="fc-activity__who">
            {ActivityColumnsFactory.initial(String(row.pluginSlug || 'S'))}
            <span className="fc-activity__value">{ActivityColumnsFactory.named(row)}</span>
          </div>
        ),
      },
      {
        header: AdminI18n.t('activity.action'),
        id: 'action',
        accessor: (row: any) => (
          <div className="fc-activity__stack">
            <span className="fc-activity__value">{row.action}</span>
            <span className="fc-activity__quiet">{row.resource}</span>
          </div>
        ),
      },
      {
        header: AdminI18n.t('activity.time'),
        id: 'timestamp',
        accessor: (row: any) => ActivityColumnsFactory.when(row.createdAt),
      },
    ];
  }
}
