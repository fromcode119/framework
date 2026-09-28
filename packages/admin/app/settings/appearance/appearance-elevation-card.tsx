import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Elevation (shadow) switch for the whole admin.
 *
 * Everything resolves through `--fc-elevation-surface` / `--fc-elevation-control`, so this one control
 * governs every panel, dialog and button — there is no per-surface setting and no component to edit.
 */
export class AppearanceElevationCard extends PureReactor {
  @prop declare enabled: boolean;
  @prop declare busy: boolean;
  @prop declare onChange: (next: boolean) => void;

  render(): ReactNode {
    return (
      <div className={`${AdminClass.SURFACE} flex items-center justify-between gap-6 p-4`}>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">{AdminI18n.t('settings.appearance.surfaceShadows')}</h3>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {AdminI18n.t('settings.appearance.depthOnPanelsDialogsAnd')}
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
