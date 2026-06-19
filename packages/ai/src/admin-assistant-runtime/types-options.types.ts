import type { McpToolDefinition } from '@fromcode119/mcp';
import type { AssistantClient } from '../types.interfaces';
import type {
  AssistantCollectionContext,
  AssistantPluginContext,
  AssistantThemeContext,
  AssistantToolSummary,
} from './types-context.types';
import type { AssistantWorkspaceMap } from './types-workspace.types';
import type { AssistantSkillDefinition } from './types-plan.types';
import type {
  AssistantSettingValue,
  AssistantPromptProfile,
  AssistantPromptCopy,
} from './types-result.types';

export type AdminAssistantRuntimeOptions = {
  aiClient?: AssistantClient | null;
  getCollections: () => AssistantCollectionContext[];
  getPlugins?: () => AssistantPluginContext[];
  getThemes?: () => AssistantThemeContext[];
  findCollectionBySlug: (source: string) => AssistantCollectionContext | null | undefined;
  listContent?: (
    collection: AssistantCollectionContext,
    options: { limit?: number; offset?: number; context?: Record<string, any> }
  ) => Promise<{ docs: any[]; totalDocs?: number; limit?: number; offset?: number }>;
  resolveContent?: (
    collection: AssistantCollectionContext,
    selector: {
      id?: string | number;
      slug?: string;
      permalink?: string;
      where?: Record<string, any>;
    },
    context: Record<string, any>
  ) => Promise<any | null>;
  createContent: (
    collection: AssistantCollectionContext,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  updateContent?: (
    collection: AssistantCollectionContext,
    targetId: string | number,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  getSetting: (key: string) => Promise<AssistantSettingValue>;
  upsertSetting: (key: string, value: string, group: string) => Promise<void>;
  resolveAdditionalTools?: (context: { dryRun: boolean }) => Promise<McpToolDefinition[]> | McpToolDefinition[];
  resolveAdditionalPromptLines?: (context: {
    collections: AssistantCollectionContext[];
    tools: AssistantToolSummary[];
  }) => Promise<string[]> | string[];
  resolveWorkspaceMap?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    themes: AssistantThemeContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantWorkspaceMap> | AssistantWorkspaceMap;
  resolvePromptProfile?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantPromptProfile> | AssistantPromptProfile;
  resolvePromptCopy?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantPromptCopy> | AssistantPromptCopy;
  resolveSkills?: () => Promise<AssistantSkillDefinition[]> | AssistantSkillDefinition[];
  now?: () => string;
};
