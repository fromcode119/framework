import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Opens and closes a field's explanation.
 *
 * A description is written for the first time someone meets a field and was printed on every visit
 * after it, so a form's explanations outweighed its values. The sentence shows when the pointer rests
 * on the ⓘ or the keyboard reaches it, and on a tap on a phone, which has no hover.
 */
import { Tooltip } from '@/components/ui/view/tooltip.client';

export class FieldHelpButton extends PureReactor {
  @prop declare label: string;
  @prop declare open: boolean;
  @prop declare onToggle: () => void;
  /** The explanation itself. Given, it shows beside the ⓘ on hover and focus, and on a tap on a phone,
      and the page under it does not move. Without it the ⓘ opens and closes whatever the caller prints. */
  @prop declare text?: ReactNode;

  render(): ReactNode {
    const about = AdminI18n.t('ui.field.about', { label: this.label });
    if (this.text) {
      return (
        <Tooltip content={this.text}>
          <button type="button" aria-label={about} className="fc-btn fc-btn--glyph shrink-0">
            <FrameworkIcons.Info size={13} />
          </button>
        </Tooltip>
      );
    }
    return (
      <button
        type="button"
        onClick={this.onToggle}
        aria-expanded={this.open}
        aria-label={about}
        title={about}
        className="fc-btn fc-btn--glyph shrink-0"
      >
        <FrameworkIcons.Info size={13} />
      </button>
    );
  }
}
