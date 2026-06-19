export type AssistantWorkspaceMapPlugin = {
  slug: string;
  name: string;
  version?: string;
  state?: string;
  capabilities?: string[];
  path?: string;
};

export type AssistantWorkspaceMapTheme = {
  slug: string;
  name: string;
  version?: string;
  state?: string;
  path?: string;
};

export type AssistantWorkspaceMapCollection = {
  slug: string;
  shortSlug: string;
  label: string;
  pluginSlug: string;
  fieldNames?: string[];
};

export type AssistantWorkspaceMapTool = {
  tool: string;
  readOnly: boolean;
};

export type AssistantWorkspaceMap = {
  generatedAt: number;
  frameworkRoot?: string;
  activeThemeSlug?: string;
  plugins: AssistantWorkspaceMapPlugin[];
  themes: AssistantWorkspaceMapTheme[];
  collections: AssistantWorkspaceMapCollection[];
  tools: AssistantWorkspaceMapTool[];
};
