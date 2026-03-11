import type { AssistantChatInput, AssistantChatResult, AssistantCollectionContext } from '../types';
import { IntentClassifier } from './intent-classifier';
import { RuntimeUtils } from './types';
import type { RuntimeContext, RuntimeDependencies } from './types.types';
import { WorkspaceMapService } from './workspace-map';
import { OrchestratorActionUtils } from './orchestrator-action-utils';
import { OrchestratorFinalizeUtils } from './orchestrator-finalize';
import { OrchestratorHandlers } from './orchestrator-handlers';

const { normalizeHistory } = OrchestratorActionUtils;

export class OrchestratorRunner {
  static async runOrchestrator(
  input: AssistantChatInput,
  deps: RuntimeDependencies,
): Promise<AssistantChatResult | null> {
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

      const context: RuntimeContext = {
        input,
        options: deps.options,
        now,
        collections,
        selectedSkill,
        tools,
        bridge,
        allowedToolSet,
        checkpoint: input?.checkpoint,
        history: normalizeHistory(input?.history),
        workspaceMap,
      };

      const planId = RuntimeUtils.createPlanId();
      const traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }> = [];

      const intent = IntentClassifier.classifyIntent({ message, history: context.history, checkpoint: context.checkpoint });
      traces.push({ iteration: 1, phase: 'planner', message: `Classified intent: ${intent.kind} (${intent.confidence.toFixed(2)})`, toolCalls: [] });

      if (intent.kind === 'homepage_draft') {
        return OrchestratorHandlers.handleHomepageDraft(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      if (intent.kind === 'replace_text') {
        return OrchestratorHandlers.handleReplaceText(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      if (intent.kind === 'action_request') {
        return OrchestratorHandlers.handleActionRequest(deps, context, intent, message, selectedSkill, agentMode, traces, planId);
      }

      return OrchestratorFinalizeUtils.finalizeChatLike(deps, context, intent, message, agentMode, traces, planId);

  }
}



