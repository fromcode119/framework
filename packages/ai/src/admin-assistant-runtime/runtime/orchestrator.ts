import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';

import { IntentClassifier } from '@ai/admin-assistant-runtime/runtime/intent-classifier';
import { RuntimeUtils } from '@ai/admin-assistant-runtime/runtime/runtime-utils';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IRuntimeDependencies } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-dependencies.interface';
import { WorkspaceMapService } from '@ai/admin-assistant-runtime/runtime/workspace-map';
import { OrchestratorActionUtils } from '@ai/admin-assistant-runtime/runtime/orchestrator-action-utils';
import { OrchestratorFinalizeUtils } from '@ai/admin-assistant-runtime/runtime/orchestrator-finalize';
import { OrchestratorHandlers } from '@ai/admin-assistant-runtime/runtime/orchestrator-handlers';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';
export class OrchestratorRunner {
  static async runOrchestrator(
  input: IAssistantChatInput,
  deps: IRuntimeDependencies,
): Promise<IAssistantChatResult | null> {
      const now = Date.now();
      const message = String(input?.message || '').trim();
      if (!message) return null;

      const skills = await deps.resolveSkills();
      const selectedSkill = deps.resolveSkillForInput(input, skills);
      const agentMode = deps.resolveAgentMode(input, selectedSkill);

      const bridge = await deps.createBridge(true);
      const tools = await deps.listTools(true);
      const collections = deps.options.getCollections();
      const workspaceMap = await WorkspaceMapService.buildWorkspaceMap({
        options: deps.options,
        collections,
        tools,
      });

      const allowedTools = Array.isArray(input?.allowedTools)
        ? input.allowedTools.map((tool) => String(tool || '').trim()).filter(Boolean)
        : [];
      const allowedToolSet = new Set<string>(allowedTools);

      const context: IRuntimeContext = {
        input,
        options: deps.options,
        now,
        collections,
        selectedSkill,
        tools,
        bridge,
        allowedToolSet,
        checkpoint: input?.checkpoint,
        history: OrchestratorActionUtils.normalizeHistory(input?.history),
        workspaceMap,
      };

      const planId = RuntimeUtils.createPlanId();
      const traces: Array<{ iteration: number; message: string; phase?: AgentRole; toolCalls: Array<{ tool: string; input: Record<string, any> }> }> = [];

      const intent = IntentClassifier.classifyIntent({ message, history: context.history, checkpoint: context.checkpoint });
      traces.push({ iteration: 1, phase: AgentRole.PLANNER, message: `Classified intent: ${intent.kind} (${intent.confidence.toFixed(2)})`, toolCalls: [] });

      if (intent.kind === RuntimeIntentKind.HOMEPAGE_DRAFT) {
        return OrchestratorHandlers.handleHomepageDraft(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      if (intent.kind === RuntimeIntentKind.REPLACE_TEXT) {
        return OrchestratorHandlers.handleReplaceText(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      if (intent.kind === RuntimeIntentKind.ACTION_REQUEST) {
        return OrchestratorHandlers.handleActionRequest(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      return OrchestratorFinalizeUtils.finalizeChatLike(deps, context, intent, message, agentMode, traces, planId);

  }
}

