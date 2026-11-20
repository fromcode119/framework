import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AppEnv } from '@/lib/env';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DashboardFooter extends PureReactor {
  @prop declare platformName: string;

  /** Version and channel are both optional at build time, so neither leaves a stray `v` behind. */
  private get build(): string {
    return [AppEnv.APP_VERSION ? `v${AppEnv.APP_VERSION}` : '', AppEnv.APP_CHANNEL]
      .filter((part) => part !== '')
      .join(' ');
  }

  render(): ReactNode {
    return (
      <div className="fc-list-actions px-6 pb-6">
        <div>
          <div className="fc-list-actions__row">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {/* No dot: this footer fetches nothing, and a glowing light beside a name reads as a
                    live status it never measured. The name and the build are facts it does have. */}
                <span className="fc-list-actions__count">
                  {AdminI18n.t('dashboard.infrastructure', { name: this.platformName })}{this.build ? ` // ${this.build}` : ''}
                </span>
              </div>
              {/* No health/topology claim here: this footer fetches nothing, so any "all systems
                  operational" line would assert a status it never measured. Live status belongs to the
                  plugin-health surface, which reads the health endpoint. */}
            </div>

            <div className="flex items-center gap-4 fc-size-xs font-medium tracking-tight fc-tone-muted">
              <a href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank" rel="noopener noreferrer" className="fc-tone-hover-brand transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
