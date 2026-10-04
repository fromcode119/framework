import type { ISettingsTab } from '@core/interfaces/settings-tab.interface';
import type { ISettingsTabGroup } from '@core/interfaces/settings-tab-group.interface';
import type { IPluginSettingsField } from '@core/plugin/interfaces/plugin-settings-field.interface';

export interface IPluginSettingsSchema {
  fields: IPluginSettingsField[];
  tabs?: ISettingsTab[];
  /** Headings over the tabs (see `ISettingsTab.group`); optional. */
  groups?: ISettingsTabGroup[];
  
  // Optional validation function
  validate?: (
    values: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<Record<string, string> | null>;
  
  // Optional save hook
  onSave?: (
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<void>;
}
