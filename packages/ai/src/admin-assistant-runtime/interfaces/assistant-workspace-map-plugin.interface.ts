export interface IAssistantWorkspaceMapPlugin {
  slug: string;
  name: string;
  version?: string;
  state?: string;
  capabilities?: string[];
  path?: string;
}
