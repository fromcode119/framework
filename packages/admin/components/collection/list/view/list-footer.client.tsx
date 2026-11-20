import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Collection list footer: a single quiet link to the list's raw endpoint. Export and import moved to
    the header beside Create. Pure presentational class. */
export class ListFooter extends PureReactor {
  @prop declare resolvedSlug: string;

  render(): ReactNode {
    // Export and import now sit in the head, beside Create, the way the reference keeps them. What is
    // left for the foot is the one developer extra the reference has no equal of — the raw endpoint —
    // a single quiet link at the end, not a band of three strung on dots.
    return (
      <div className="fc-list-foot">
        <div className="fc-list-foot__actions">
          <a
            className="fc-list-foot__action"
            href={`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${this.resolvedSlug}`}
            target="_blank"
          >
            <FrameworkIcons.Code size={15} />
            {AdminI18n.t('collection.list.apiEndpoint')}
          </a>
        </div>
      </div>
    );
  }
}
