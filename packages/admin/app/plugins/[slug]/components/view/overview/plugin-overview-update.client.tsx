import { Alert } from '@/components/ui/view/alert.client';
import { InlineTip } from '@/components/ui/view/inline-tip.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A newer release is ready: its version, what is new in it, and — for the platform — the button that
 * installs it. A site sees that it exists; updating is the platform's.
 */
export class PluginOverviewUpdate extends PureReactor {
  @prop declare item: IPluginMarketplaceItem;
  @prop declare canUpdate: boolean;
  @prop declare isUpdating: boolean;
  @prop declare onUpdate: () => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const changes = Array.isArray(this.item.changelog) ? this.item.changelog : [];
    return (
      <div className="fc-stack">
        <Alert tone="info" title={AdminI18n.t('plugins.detail.versionReady', { version: this.item.version })}
          action={this.canUpdate ? (
            <Button variant={ButtonVariant.PRIMARY} isLoading={this.isUpdating} icon={<FrameworkIcons.Zap size={15} />} onClick={this.onUpdate}>
              {this.isUpdating ? AdminI18n.t('plugins.detail.updating') : AdminI18n.t('plugins.detail.updateAvailable')}
            </Button>
          ) : undefined} />
        {changes.map((change) => <InlineTip key={change} label={`v${this.item.version}`}>{change}</InlineTip>)}
      </div>
    );
  }
}
