import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the Configuration tab says when the plugin offers no fields.
 *
 * Two different truths share that empty list. A plugin declares its settings when it STARTS, so one
 * that is held for approval or switched off has declared none YET, and "no configurable settings"
 * told the operator the plugin had nothing to set when it simply had not run. `waiting` carries the
 * difference.
 */
export class PluginSettingsEmpty extends PureReactor {
  /** The plugin is not running, so its settings are not known yet. */
  @prop declare waiting: boolean;

  render(): ReactNode {
    return (
      <EmptyState
        icon={<FrameworkIcons.Settings size={22} />}
        title={AdminI18n.t(this.waiting ? 'plugins.list.settingsWaitingTitle' : 'plugins.list.thisPluginHasNoConfigurable')}
        hint={this.waiting ? AdminI18n.t('plugins.list.settingsWaitingHelp') : undefined}
      />
    );
  }
}
