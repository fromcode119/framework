import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
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
      <Card title={AdminI18n.t('settings.security.processLimitsTitle')}>
        {ordered.length === 0 ? (
          <p className="pt-2 text-sm text-slate-500">{AdminI18n.t('settings.security.noPluginIsRunningIn')}</p>
        ) : (
          <div className="pt-2 space-y-4">
            {ordered.map((group) => (
              <div key={`${group.memoryMb}|${group.timeoutMs}`}>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                  {AdminI18n.t('settings.security.processLimitsGroup', { count: group.slugs.length, memory: group.memoryMb, seconds: Math.round(group.timeoutMs / 100) / 10 })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.slugs.sort().map((slug) => (
                    <span key={slug} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{slug}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}
