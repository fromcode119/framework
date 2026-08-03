import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantChatResult } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-result.interface';
import type { IAssistantExecuteInput } from '@ai/admin-assistant-runtime/interfaces/assistant-execute-input.interface';
import type { IAssistantExecuteResult } from '@ai/admin-assistant-runtime/interfaces/assistant-execute-result.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';
import { OrchestratorRunner } from '@ai/admin-assistant-runtime/runtime/orchestrator';
import { ResponseBuilder } from '@ai/admin-assistant-runtime/runtime/response';
import { ProviderCapabilitiesUtils } from '@ai/gateways/integration-provider';
import { AdminAssistantRuntimeSkillService } from '@ai/admin-assistant-runtime-engine/admin-assistant-runtime-skill-service';
import { AdminAssistantRuntimeBridgeService } from '@ai/admin-assistant-runtime-engine/admin-assistant-runtime-bridge-service';
import { AdminAssistantRuntimeArtifactService } from '@ai/admin-assistant-runtime-engine/admin-assistant-runtime-artifact-service';
import { AdminAssistantRuntimeActionExecutor } from '@ai/admin-assistant-runtime-engine/admin-assistant-runtime-action-executor';

export class AdminAssistantRuntimeEngine {
  private readonly skillService: AdminAssistantRuntimeSkillService;
  private readonly bridgeService: AdminAssistantRuntimeBridgeService;
  private readonly artifactService: AdminAssistantRuntimeArtifactService;
  private readonly actionExecutor: AdminAssistantRuntimeActionExecutor;

  constructor(private readonly options: IAdminAssistantRuntimeOptions) {
    this.skillService = new AdminAssistantRuntimeSkillService(options);
    this.bridgeService = new AdminAssistantRuntimeBridgeService(options);
    this.artifactService = new AdminAssistantRuntimeArtifactService(options.now || (() => new Date().toISOString()));
    this.actionExecutor = new AdminAssistantRuntimeActionExecutor(options);
  }

  async listSkills(): Promise<IAssistantSkillDefinition[]> {
    return this.skillService.listSkills();
  }

  async listTools(dryRun: boolean = true): Promise<IAssistantToolSummary[]> {
    return this.bridgeService.listTools(dryRun);
  }

  async chat(input: IAssistantChatInput): Promise<IAssistantChatResult> {
    const aiClient = this.options.aiClient;
    if (!aiClient || typeof aiClient.chat !== 'function') {
      throw new Error('AI Assistant integration is not configured.');
    }

    const message = String(input?.message || '').trim();
    if (!message) {
      throw new Error('message is required');
    }

    const orchestrated = await OrchestratorRunner.runOrchestrator(input, {
      options: this.options,
      resolveSkills: () => this.listSkills(),
      createBridge: (dryRun: boolean) => this.bridgeService.buildBridge(dryRun),
      listTools: (dryRun: boolean) => this.bridgeService.listTools(dryRun),
      sanitizeMessage: (value: string) => ResponseBuilder.stripBannedOpener(value),
      toRunMode: (value: string) => this.skillService.toRunMode(value),
      buildPlanArtifact: (value: any) => this.artifactService.buildPlanArtifact(value),
      buildUiHints: (value: any) => this.artifactService.buildUiHints(value),
      resolveAgentMode: (payload: IAssistantChatInput, selectedSkill?: IAssistantSkillDefinition) =>
        this.skillService.resolveAgentMode(payload, selectedSkill),
      resolveSkillForInput: (payload: IAssistantChatInput, skills: IAssistantSkillDefinition[]) =>
        this.skillService.resolveSkillForInput(payload, skills),
      resolveProviderCapabilities: (provider: string) => ProviderCapabilitiesUtils.resolveProviderCapabilities(provider),
    });

    if (orchestrated) {
      return orchestrated;
    }

    throw new Error('Assistant runtime engine did not produce a response.');
  }

  async executeActions(input: IAssistantExecuteInput): Promise<IAssistantExecuteResult> {
    return this.actionExecutor.executeActions(input, (dryRun: boolean) => this.bridgeService.buildBridge(dryRun));
  }
}
