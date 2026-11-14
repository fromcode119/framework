import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The one way a settings screen is saved: a bar at the foot of the page that exists while something
 * on it differs from what was read, with Save and Discard.
 *
 * A Save button that stood in the header on every visit said nothing about whether there was anything
 * to save. The bar appears on the first change and goes away once the change is written or thrown
 * away, so its presence is itself the answer. Its look is `fc-settings-savebar` in `settings.css`.
 */
export class SettingsSaveBar extends PureReactor {
  @prop declare dirty: boolean;
  @prop declare saving?: boolean;
  @prop declare onSave: () => void | Promise<void>;
  /** Puts back what was read. Without it the bar offers only Save. */
  @prop declare onDiscard?: () => void;

  render(): ReactNode {
    if (!this.dirty && !this.saving) return null;
    return (
      <div className={AdminClass.of('settings-savebar')} role="region" aria-label={AdminI18n.t('ui.saveBar.unsaved')}>
        <span className={AdminClass.of('settings-savebar__text')}>{AdminI18n.t('ui.saveBar.unsaved')}</span>
        {this.onDiscard ? (
          <button type="button" className={AdminClass.of('settings-savebar__reset')} onClick={this.onDiscard} disabled={this.saving}>
            {AdminI18n.t('ui.saveBar.discard')}
          </button>
        ) : null}
        <Button onClick={this.onSave} isLoading={this.saving}>{AdminI18n.t('ui.saveBar.save')}</Button>
      </div>
    );
  }
}
