import type { ReactNode } from 'react';

import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
export class SidebarMiniToggle extends PureReactor {
  @prop declare isMini: boolean | undefined;
  @prop declare onMiniToggle: (() => void) | undefined;

  render(): ReactNode {
    const isMini = this.isMini;
    const onMiniToggle = this.onMiniToggle;
    return (
      <div className={`border-t fc-tone-line hidden lg:block fc-canvas  ${isMini ? 'p-2' : 'px-3 py-3'}`}>
        <Button
          type="button"
          variant={ButtonVariant.GHOST}
          size={isMini ? FieldSize.ICON : FieldSize.MD}
          block={!isMini}
          onClick={onMiniToggle}
          aria-label={AdminI18n.t(isMini ? 'shell.nav.expand' : 'shell.nav.collapse')}
          title={AdminI18n.t(isMini ? 'shell.nav.expand' : 'shell.nav.collapse')}
          icon={<FrameworkIcons.Left size={15} className={`transition-transform duration-500 ${isMini ? 'rotate-180' : ''}`} />}
        >
          {isMini ? null : AdminI18n.t('shell.nav.collapse')}
        </Button>
      </div>
    );
  }
}
