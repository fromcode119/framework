import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Whether a section's pages stand in a second column beside the menu, for the whole console.
 *
 * The one menu is the console's shape; this switch brings back the column for an operator who
 * prefers it. Everything hangs off one attribute on `<html>` (see `NavLayoutService`), so there is
 * no per-section setting and no component to edit.
 */
export class AppearanceNavColumnCard extends PureReactor {
  @prop declare enabled: boolean;
  @prop declare busy: boolean;
  @prop declare onChange: (next: boolean) => void;

  render(): ReactNode {
    return (
      <div className={`${AdminClass.SURFACE} flex items-center justify-between gap-6 p-4`}>
        <div className="min-w-0">
          <h3 className="fc-size-sm font-medium tracking-tight fc-tone-text">{AdminI18n.t('settings.appearance.secondMenuColumn')}</h3>
          <p className="mt-0.5 fc-size-xs font-medium leading-relaxed fc-tone-muted">
            {AdminI18n.t('settings.appearance.sectionPagesBesideTheMenu')}
          </p>
        </div>
        <Switch
          checked={this.enabled}
          disabled={this.busy}
          onChange={(next: boolean) => this.onChange(next)}
        />
      </div>
    );
  }
}
