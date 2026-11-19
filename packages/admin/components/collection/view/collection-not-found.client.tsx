import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { StatePage } from '@/components/ui/view/state-page.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class CollectionNotFound extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare slug: string;
  @prop declare pluginSlug: string;

  @bound goBack(): void {
    window.history.back();
  }

  render(): React.ReactNode {
    const { slug, pluginSlug } = this;
    // The console's empty state, the same one a list with no rows shows. This was a page of its own:
    // a 64px indigo glass in a glowing card under a 36px title.
    return (
      <StatePage
        icon={<FrameworkIcons.Search size={18} />}
        title={AdminI18n.t('collection.notFound.title')}
        hint={AdminI18n.t('collection.notFound.text', { collection: slug, plugin: pluginSlug })}
        actions={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.goBack}>{AdminI18n.t('common.goBack')}</Button>
            <Button variant={ButtonVariant.PRIMARY} as={AdminLink} href="/">{AdminI18n.t('common.toDashboard')}</Button>
          </>
        )}
      />
    );
  }
}
