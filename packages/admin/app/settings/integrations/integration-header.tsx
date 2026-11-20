import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Spinner } from '@/components/ui/view/spinner.client';

/**
 * The page's header — the same compact header every settings page has. Saving is the Save bar at the
 * foot of the page, as on every settings screen; resetting cached admin JavaScript is not everyday, so
 * it sits in ⋯.
 */
export class IntegrationHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationHeader, 'theme' | 'resettingStaleJs' | 'onResetStaleJs'>;

  @prop declare theme: ThemeMode;
  @prop declare resettingStaleJs: boolean;
  @prop declare onResetStaleJs: () => void;

  private renderActions(): ReactNode {
    return (
      <div className="flex items-center gap-2">
        <Dropdown align={HorizontalAlign.RIGHT} items={[{
          label: AdminI18n.t('settings.integrations.resetStaleJs'),
          icon: this.resettingStaleJs ? <Spinner /> : <FrameworkIcons.Refresh size={14} />,
          onClick: this.onResetStaleJs,
        }]} trigger={
          <span aria-label={AdminI18n.t('settings.integrations.more')} className="fc-toolbar-btn fc-toolbar-btn--icon">
            <FrameworkIcons.More size={16} />
          </span>
        } />
      </div>
    );
  }

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        icon={<FrameworkIcons.Plugins size={18} strokeWidth={2} />}
        title={AdminI18n.t('settings.integrations.integrations')}
        subtitle={AdminI18n.t('settings.integrations.pageSubtitle')}
        actions={this.renderActions()}
      />
    );
  }
}
