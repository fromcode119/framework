import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { AdminLink } from '@/components/view/admin-link.client';
import { PluginUnavailableReason } from '@/components/plugins/view/plugin-unavailable-reason.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { StatePage } from '@/components/ui/view/state-page.client';

export class PluginNotFound extends PureReactor {
  @prop declare pluginSlug: string;

  render(): ReactNode {
    // The console's state page, the same face a missing collection or theme shows. When the extension
    // exists but is not running, its STATE is the answer, said after the first sentence.
    return (
      <StatePage
        icon={<FrameworkIcons.Plugins size={18} />}
        title={AdminI18n.t('plugins.list.moduleNotFound')}
        hint={<>{AdminI18n.t('plugins.list.nothingServing', { path: `/${this.pluginSlug}` })} <PluginUnavailableReason pluginSlug={this.pluginSlug} /></>}
        actions={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={() => window.history.back()}>{AdminI18n.t('plugins.list.goBack')}</Button>
            <Button variant={ButtonVariant.PRIMARY} as={AdminLink} href="/plugins">{AdminI18n.t('plugins.list.managePlugins')}</Button>
          </>
        )}
      />
    );
  }
}
