import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * "These settings belong to a site — and no site is selected."
 *
 * The scope sibling of {@link PlatformOnlyPanel}, which answers the ROLE question ("this screen is
 * the platform's, and you administer a site"). This answers the SCOPE one: the screen is a site's,
 * and the console is currently in the platform scope, where the API refuses every save on it.
 *
 * Without this, pages of purely per-site settings rendered their full form in the platform scope and
 * lost the operator's edits on save — Security lost all twenty-three at once. A form that cannot act
 * is the magic this codebase forbids; the page says what it is instead.
 */
export class SiteScopePanel extends PureReactor {
  /** Which settings these are, in the operator's terms, and where they live. */
  @prop declare detail: ReactNode;

  render(): ReactNode {
    return (
      <div className="py-6 w-full">
        <Card title={AdminI18n.t('ui.view.theseSettingsBelongToA')}>
          <Hint>{this.detail}</Hint>
        </Card>
      </div>
    );
  }
}
