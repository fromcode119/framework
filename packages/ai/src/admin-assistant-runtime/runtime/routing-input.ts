import type { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';
import type { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import type { IProviderCapabilities } from '@ai/admin-assistant-runtime/interfaces/provider-capabilities.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';

/**
 * What `ModelRouter` needs in order to pick a generation profile: the kind of request, how much context
 * the caller granted, what the provider can actually do, and the skill in play (if any).
 *
 * A data record, so a CLASS — it was a `type` literal declared inline in the router's own file.
 */
export class RoutingInput {
  constructor(
    readonly intentKind: RuntimeIntentKind,
    readonly agentMode: ContextLevel,
    readonly capabilities: IProviderCapabilities,
    readonly selectedSkill?: IAssistantSkillDefinition,
  ) {}
}
