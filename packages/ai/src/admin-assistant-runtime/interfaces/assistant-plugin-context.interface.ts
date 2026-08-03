export interface IAssistantPluginContext {
  slug: string;
  name: string;
  version: string;
  state: string;
  capabilities?: string[];
  path?: string;
}
