import type { IMcpToolDefinition } from '@fromcode119/mcp';
import type { IAssistantClient } from '@ai/interfaces/assistant-client.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';
import type { IAssistantPluginContext } from '@ai/admin-assistant-runtime/interfaces/assistant-plugin-context.interface';
import type { IAssistantThemeContext } from '@ai/admin-assistant-runtime/interfaces/assistant-theme-context.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import type { IAssistantWorkspaceMap } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantSettingValue } from '@ai/admin-assistant-runtime/interfaces/assistant-setting-value.interface';
import type { IAssistantPromptProfile } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-profile.interface';
import type { IAssistantPromptCopy } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-copy.interface';

export interface IAdminAssistantRuntimeOptions {
  aiClient?: IAssistantClient | null;
  getCollections: () => IAssistantCollectionContext[];
  getPlugins?: () => IAssistantPluginContext[];
  getThemes?: () => IAssistantThemeContext[];
  findCollectionBySlug: (source: string) => IAssistantCollectionContext | null | undefined;
  listContent?: (
    collection: IAssistantCollectionContext,
    options: { limit?: number; offset?: number; context?: Record<string, any> }
  ) => Promise<{ docs: any[]; totalDocs?: number; limit?: number; offset?: number }>;
  resolveContent?: (
    collection: IAssistantCollectionContext,
    selector: {
      id?: string | number;
      slug?: string;
      permalink?: string;
      where?: Record<string, any>;
    },
    context: Record<string, any>
  ) => Promise<any | null>;
  createContent: (
    collection: IAssistantCollectionContext,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  updateContent?: (
    collection: IAssistantCollectionContext,
    targetId: string | number,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  getSetting: (key: string) => Promise<IAssistantSettingValue>;
  upsertSetting: (key: string, value: string, group: string) => Promise<void>;
  resolveAdditionalTools?: (context: { dryRun: boolean }) => Promise<IMcpToolDefinition[]> | IMcpToolDefinition[];
  resolveAdditionalPromptLines?: (context: {
    collections: IAssistantCollectionContext[];
    tools: IAssistantToolSummary[];
  }) => Promise<string[]> | string[];
  resolveWorkspaceMap?: (context: {
    collections: IAssistantCollectionContext[];
    plugins: IAssistantPluginContext[];
    themes: IAssistantThemeContext[];
    tools: IAssistantToolSummary[];
  }) => Promise<IAssistantWorkspaceMap> | IAssistantWorkspaceMap;
  resolvePromptProfile?: (context: {
    collections: IAssistantCollectionContext[];
    plugins: IAssistantPluginContext[];
    tools: IAssistantToolSummary[];
  }) => Promise<IAssistantPromptProfile> | IAssistantPromptProfile;
  resolvePromptCopy?: (context: {
    collections: IAssistantCollectionContext[];
    plugins: IAssistantPluginContext[];
    tools: IAssistantToolSummary[];
  }) => Promise<IAssistantPromptCopy> | IAssistantPromptCopy;
  resolveSkills?: () => Promise<IAssistantSkillDefinition[]> | IAssistantSkillDefinition[];
  now?: () => string;
}
