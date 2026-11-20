import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { Spinner } from '@/components/ui/view/spinner.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The one way a settings screen is saved: the console's command bar at the foot of the window, there
 * while something on the screen differs from what was read, with Discard and Save.
 *
 * A Save button that stood in the header on every visit said nothing about whether there was anything
 * to save. The bar appears on the first change and goes away once the change is written or thrown
 * away, so its presence is itself the answer. It is the same bar a record page saves from; it was a
 * light strip of its own, sticky in the page, which on a short page sat right under the last card.
 */
export class SettingsSaveBar extends PureReactor {
  @prop declare dirty: boolean;
  @prop declare saving?: boolean;
  @prop declare onSave: () => void | Promise<void>;
  /** Puts back what was read. Without it the bar offers only Save. */
  @prop declare onDiscard?: () => void;

  render(): ReactNode {
    const open = Boolean(this.dirty || this.saving);
    return (
      <>
        {/* The bar floats over the foot of the window; this keeps room for it below the page's last
            card, so it never covers what was just changed there. */}
        {open ? <div className={AdminClass.of('settings-savebar-space')} aria-hidden="true" /> : null}
        <CommandBar open={open} value={AdminI18n.t('ui.saveBar.unsaved')}>
          {this.onDiscard ? (
            <CommandBarCommand label={AdminI18n.t('ui.saveBar.discard')} onClick={this.onDiscard} disabled={this.saving} />
          ) : null}
          <CommandBarCommand
            label={AdminI18n.t('ui.saveBar.save')}
            icon={this.saving ? <Spinner /> : <FrameworkIcons.Save size={15} />}
            disabled={this.saving}
            onClick={() => void this.onSave()}
          />
        </CommandBar>
      </>
    );
  }
}
