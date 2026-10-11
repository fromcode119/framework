import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Plugins the security monitor recorded denials for in the last day, or a plain "nothing recorded". */
export class SecuritySuspiciousActivity extends PureReactor {
  declare props: Pick<SecuritySuspiciousActivity, 'plugins'>;

  @prop declare plugins: Array<{ slug: string; count: number }>;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.suspiciousActivity')}>
        <div className="space-y-3 pt-2">
          {this.plugins.length > 0 ? (
            this.plugins.map((plugin) => (
              <div key={plugin.slug} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{plugin.slug}</span>
                  <span className="text-[12px] text-slate-500 mt-0.5">{AdminI18n.t('settings.security.denialsRecorded', { count: plugin.count })}</span>
                </div>
                <div className="h-2 w-2 rounded-full bg-red-500" />
              </div>
            ))
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <FrameworkIcons.Check size={16} className="text-green-500" />
              {AdminI18n.t('settings.security.noSuspiciousPatternsDetected')}
            </p>
          )}
        </div>
      </Card>
    );
  }
}
