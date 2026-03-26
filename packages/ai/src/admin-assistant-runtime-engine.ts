import type {
  AdminAssistantRuntimeOptions,
  AssistantChatInput,
  AssistantChatResult,
  AssistantExecuteInput,
  AssistantExecuteResult,
  AssistantSkillDefinition,
  AssistantToolSummary,
} from './admin-assistant-runtime/types';
import { OrchestratorRunner } from './admin-assistant-runtime/runtime/orchestrator';
import { ResponseBuilder } from './admin-assistant-runtime/runtime/response';
import { ProviderCapabilitiesUtils } from './gateways/integration-provider';
import { AdminAssistantRuntimeSkillService } from './admin-assistant-runtime-engine/admin-assistant-runtime-skill-service';
import { AdminAssistantRuntimeBridgeService } from './admin-assistant-runtime-engine/admin-assistant-runtime-bridge-service';
import { AdminAssistantRuntimeArtifactService } from './admin-assistant-runtime-engine/admin-assistant-runtime-artifact-service';
import { AdminAssistantRuntimeActionExecutor } from './admin-assistant-runtime-engine/admin-assistant-runtime-action-executor';

export class AdminAssistantRuntimeEngine {
  private readonly skillService: AdminAssistantRuntimeSkillService;
  private readonly bridgeService: AdminAssistantRuntimeBridgeService;
  private readonly artifactService: AdminAssistantRuntimeArtifactService;
  private readonly actionExecutor: AdminAssistantRuntimeActionExecutor;

  constructor(private readonly options: AdminAssistantRuntimeOptions) {
    this.skillService = new AdminAssistantRuntimeSkillService(options);
    this.bridgeService = new AdminAssistantRuntimeBridgeService(options);
    this.artifactService = new AdminAssistantRuntimeArtifactService(options.now || (() => new Date().toISOString()));
    this.actionExecutor = new AdminAssistantRuntimeActionExecutor(options);
  }

  async listSkills(): Promise<AssistantSkillDefinition[]> {
    return this.skillService.listSkills();
  }

  async listTools(dryRun: boolean = true): Promise<AssistantToolSummary[]> {
    return this.bridgeService.listTools(dryRun);
  }

  async chat(input: AssistantChatInput): Promise<AssistantChatResult> {
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
      resolveAgentMode: (payload: AssistantChatInput, selectedSkill?: AssistantSkillDefinition) =>
        this.skillService.resolveAgentMode(payload, selectedSkill),
      resolveSkillForInput: (payload: AssistantChatInput, skills: AssistantSkillDefinition[]) =>
        this.skillService.resolveSkillForInput(payload, skills),
      resolveProviderCapabilities: (provider: string) => ProviderCapabilitiesUtils.resolveProviderCapabilities(provider),
    });

    if (orchestrated) {
      return orchestrated;
    }

    throw new Error('Assistant runtime engine did not produce a response.');
  }

  async executeActions(input: AssistantExecuteInput): Promise<AssistantExecuteResult> {
    return this.actionExecutor.executeActions(input, (dryRun: boolean) => this.bridgeService.buildBridge(dryRun));
  }
}
