import { AssistantRole } from '@ai/enums/assistant-role.enum';

import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';
import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';

import type { IAssistantWorkspaceMap } from '@ai/admin-assistant-runtime/interfaces/assistant-workspace-map.interface';
import type { IMcpBridge } from '@fromcode119/mcp';

export interface IRuntimeContext {
  input: IAssistantChatInput;
  options: IAdminAssistantRuntimeOptions;
  now: number;
  collections: IAssistantCollectionContext[];
  selectedSkill?: IAssistantSkillDefinition;
  tools: IAssistantToolSummary[];
  bridge: IMcpBridge;
  allowedToolSet: Set<string>;
  checkpoint?: IAssistantSessionCheckpoint;
  history: Array<{ role: AssistantRole; content: string }>;
  workspaceMap: IAssistantWorkspaceMap;
}
