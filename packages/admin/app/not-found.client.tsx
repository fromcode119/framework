import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { StatePage } from '@/components/ui/view/state-page.client';

export class NotFound extends AdminComponent {
  @bound
  goBack(): void {
    window.history.back();
  }

  render(): ReactNode {
    // The console's state page, the same face a missing collection, plugin or theme shows.
    return (
      <StatePage
        icon={<FrameworkIcons.Search size={18} />}
        title={AdminI18n.t('notFound.title')}
        hint={AdminI18n.t('notFound.text')}
        actions={(
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.goBack}>{AdminI18n.t('common.goBack')}</Button>
            <Button variant={ButtonVariant.PRIMARY} as={AdminLink} href="/">{AdminI18n.t('nav.items.dashboard')}</Button>
          </>
        )}
      />
    );
  }
}
