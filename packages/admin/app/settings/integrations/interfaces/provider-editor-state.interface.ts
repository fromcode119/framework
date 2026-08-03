

export interface IProviderEditorState {
  isNew: boolean;
  providerId: string;
  providerKey: string;
  providerName: string;
  enabled: boolean;
  config: Record<string, any>;
  preservedSecretFields: Record<string, boolean>;
}
