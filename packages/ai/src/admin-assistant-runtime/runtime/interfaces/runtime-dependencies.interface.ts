import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';

import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IProviderCapabilities } from '@ai/admin-assistant-runtime/interfaces/provider-capabilities.interface';

import type { IMcpBridge } from '@fromcode119/mcp';

export interface IRuntimeDependencies {
  options: IAdminAssistantRuntimeOptions;
  resolveSkills: () => Promise<IAssistantSkillDefinition[]>;
  createBridge: (dryRun: boolean) => Promise<IMcpBridge>;
  listTools: (dryRun: boolean) => Promise<IAssistantToolSummary[]>;
  sanitizeMessage: (message: string) => string;
  toRunMode: (value: string) => AssistantRunMode;
  buildPlanArtifact: (input: {
    planId: string;
    goal: string;
    message: string;
    actions: IAssistantAction[];
    traces: Array<{ iteration: number; message: string; phase?: AgentRole; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: IAssistantSkillDefinition;
  }) => any;
  buildUiHints: (input: {
    hasActions: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: IAssistantSkillDefinition;
    planningPassesUsed?: number;
    needsClarification?: boolean;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    loopRecoveryMode?: ClarifyMode;
  }) => any;
  resolveAgentMode: (input: IAssistantChatInput, selectedSkill?: IAssistantSkillDefinition) => ContextLevel;
  resolveSkillForInput: (input: IAssistantChatInput, skills: IAssistantSkillDefinition[]) => IAssistantSkillDefinition | undefined;
  resolveProviderCapabilities: (provider: string) => IProviderCapabilities;
}
