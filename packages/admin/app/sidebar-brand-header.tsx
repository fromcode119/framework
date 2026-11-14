import type { ReactNode } from 'react';

import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminPathUtils } from '@/lib/admin-path';
import { AppEnv } from '@/lib/env';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ConsoleMountContext } from '@/components/view/console-mount-context.client';
export class SidebarBrandHeader extends PureReactor {
  /** The console mount, so the mark resolves on a console served from a site's console path. */
  static contextType = ConsoleMountContext.context;
  declare context: string;
  @prop declare isMini: boolean | undefined;
  @prop declare platformName: string;
  @prop declare onClose: (() => void) | undefined;
  /** The bell, beside the name. */
  @prop declare notifications?: ReactNode;

  render(): ReactNode {
    const isMini = this.isMini;
    const platformName = this.platformName;
    const onClose = this.onClose;
    return (
      <div className={`fc-nav-brand ${isMini ? 'fc-nav-brand--mini' : ''}`}>
        <img src={AdminPathUtils.toBrowserPath(AppEnv.BRAND_MARK_PATH, this.context)} alt={AdminI18n.t('shell.brand.markAlt', { name: platformName })} className="fc-nav-brand__mark" />
        {!isMini && <span className="fc-nav-brand__name">{platformName}</span>}
        {!isMini && (
          <span className="fc-nav-brand__tools">
            {this.notifications}
            <button type="button" onClick={onClose} aria-label={AdminI18n.t('common.close')} className="fc-nav-brand__tool fc-nav-brand__tool--narrow">
              <FrameworkIcons.Close size={18} />
            </button>
          </span>
        )}
      </div>
    );
  }
}
