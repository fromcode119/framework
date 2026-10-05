import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the Configuration tab says when the plugin offers no fields.
 *
 * Two different truths share that empty list. A plugin declares its settings when it STARTS, so one
 * that is held for approval or switched off has declared none YET, and "no configurable settings"
 * told the operator the plugin had nothing to set when it simply had not run. `waiting` carries the
 * difference.
 *
 * It sits directly on the tab's own surface: the tab is already a rounded panel, and a second rounded,
 * bordered box inside it read as a card in a card.
 */
export class PluginSettingsEmpty extends PureReactor {
  /** The plugin is not running, so its settings are not known yet. */
  @prop declare waiting: boolean;

  render(): ReactNode {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <FrameworkIcons.Settings size={28} className="mb-1 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {AdminI18n.t(this.waiting ? 'plugins.list.settingsWaitingTitle' : 'plugins.list.thisPluginHasNoConfigurable')}
        </p>
        {this.waiting ? (
          <p className="max-w-sm text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {AdminI18n.t('plugins.list.settingsWaitingHelp')}
          </p>
        ) : null}
      </div>
    );
  }
}
