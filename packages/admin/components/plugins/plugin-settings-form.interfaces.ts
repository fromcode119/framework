export interface PluginSettingsFormProps {
  pluginSlug: string;
  formId?: string;
  onStateChange?: (isDirty: boolean, saving: boolean) => void;
}

export interface PluginSettingsFormHandle {
  exportSettings: () => void;
  importSettings: () => void;
  resetSettings: () => void;
}
