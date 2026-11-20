import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { StatePage } from '@/components/ui/view/state-page.client';

/**
 * Shown instead of the create form when a collection declares `admin.disableCreate`.
 *
 * The flag says an operator cannot add rows here: the runtime writes them. Serving the form anyway let
 * anyone hand-type a row that looks exactly like one the runtime produced — an order line, a consent
 * record, a scheduled job — with none of the checks, history or state machine the real writer applies.
 */
export class CollectionCreateDisabled extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare listHref: string;

  render(): ReactNode {
    return (
      <StatePage
        icon={<FrameworkIcons.Lock size={18} />}
        title={AdminI18n.t('collection.notCreatedByHand', { title: this.title })}
        hint={this.description || AdminI18n.t('collection.recordsInThisCollectionAre')}
        actions={<Button variant={ButtonVariant.PRIMARY} as={AdminLink} href={this.listHref}>{AdminI18n.t('collection.backTo', { title: this.title })}</Button>}
      />
    );
  }
}
