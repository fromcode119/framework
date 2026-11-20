import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { StatePage } from '@/components/ui/view/state-page.client';

/**
 * The theme page for a slug this site cannot see — a bookmark, a link from another site, a theme the
 * platform installed but no one assigned here. It used to render nothing at all. The same face as the
 * plugin page's PluginNotFound, so the two extension pages fail the same way.
 */
export class ThemeNotFound extends PureReactor {
  @prop declare themeSlug: string;

  @prop declare themesHref: string;

  render(): ReactNode {
    // The console's state page, the same face a missing collection or plugin shows.
    return (
      <StatePage
        icon={<FrameworkIcons.Palette size={18} />}
        title={AdminI18n.t('themes.notAvailableHere', { slug: this.themeSlug })}
        hint={AdminI18n.t('themes.notAvailableHereHelp')}
        actions={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={() => window.history.back()}>{AdminI18n.t('plugins.list.goBack')}</Button>
            <Button variant={ButtonVariant.PRIMARY} as={AdminLink} href={this.themesHref}>{AdminI18n.t('themes.manageThemes')}</Button>
          </>
        )}
      />
    );
  }
}
