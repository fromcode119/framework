import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Text } from '@/components/ui/view/text.client';
import { Badge } from '@/components/ui/view/badge.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The limits every plugin process runs under, grouped: plugins sharing a memory ceiling and a per-call
 * deadline are one line with their names, so a plugin with its own limits stands out instead of being
 * one row among thirty identical ones.
 */
export class SecurityProcessLimits extends PureReactor {
  declare props: Pick<SecurityProcessLimits, 'processes'>;

  @prop declare processes: Array<{ slug: string; memoryMb: number; timeoutMs: number }>;

  render(): ReactNode {
    const groups = new Map<string, { memoryMb: number; timeoutMs: number; slugs: string[] }>();
    for (const entry of this.processes) {
      const key = `${entry.memoryMb}|${entry.timeoutMs}`;
      const group = groups.get(key) ?? { memoryMb: entry.memoryMb, timeoutMs: entry.timeoutMs, slugs: [] };
      group.slugs.push(String(entry.slug));
      groups.set(key, group);
    }
    const ordered = [...groups.values()].sort((a, b) => b.slugs.length - a.slugs.length);
    return (
      <RecordCard title={AdminI18n.t('settings.security.processLimitsTitle')}>
        {ordered.length === 0 ? (
          <EmptyState inline title={AdminI18n.t('settings.security.noPluginIsRunningIn')} />
        ) : ordered.map((group) => (
          <div key={`${group.memoryMb}|${group.timeoutMs}`} className="fc-card-block">
            <Text weight="plus">
              {AdminI18n.t('settings.security.processLimitsGroup', { count: group.slugs.length, memory: group.memoryMb, seconds: Math.round(group.timeoutMs / 100) / 10 })}
            </Text>
            <div className="fc-chip-row">
              {group.slugs.sort().map((slug) => <Badge key={slug}>{slug}</Badge>)}
            </div>
          </div>
        ))}
      </RecordCard>
    );
  }
}
