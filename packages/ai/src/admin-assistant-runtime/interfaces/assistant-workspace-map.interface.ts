import type { IAssistantWorkspaceMapPlugin } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map-plugin.interface';
import type { IAssistantWorkspaceMapTheme } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map-theme.interface';
import type { IAssistantWorkspaceMapCollection } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map-collection.interface';
import type { IAssistantWorkspaceMapTool } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map-tool.interface';

export interface IAssistantWorkspaceMap {
  generatedAt: number;
  frameworkRoot?: string;
  activeThemeSlug?: string;
  plugins: IAssistantWorkspaceMapPlugin[];
  themes: IAssistantWorkspaceMapTheme[];
  collections: IAssistantWorkspaceMapCollection[];
  tools: IAssistantWorkspaceMapTool[];
}
