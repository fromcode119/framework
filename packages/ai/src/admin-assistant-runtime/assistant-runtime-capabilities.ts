import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';
import type { IAssistantPluginContext } from '@ai/admin-assistant-runtime/interfaces/assistant-plugin-context.interface';
import type { IAssistantPromptCopy } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-copy.interface';
import type { IAssistantPromptProfile } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-profile.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';

/**
 * Fail-closed accessors for the OPTIONAL members of `IAdminAssistantRuntimeOptions`.
 *
 * The host decides which capabilities it wires (`listContent`, `getPlugins`, `resolvePromptProfile`,
 * `resolvePromptCopy` are all `?`), so callers legitimately have to cope with their absence — but they
 * were each coping with a scattered `typeof options.x === 'function'`, which is the defensive-contract
 * check the house rules ban. The rule's own remedy is that the framework exposes a safe accessor, so
 * this is that one place; every caller now asks for the value, never for the shape.
 *
 * `canListContent` exists SEPARATELY from `listContent` on purpose. Two call sites use the capability
 * as part of a branch CONDITION — if a missing `listContent` silently returned an empty page, the
 * orchestrator would enter its listing branch and answer "this collection has no records to inspect"
 * instead of falling through to the model. The probe keeps that routing decision intact.
 */
export class AssistantRuntimeCapabilities {
  /** Whether the host wired record listing at all. Use before a branch that only makes sense with it. */
  static canListContent(options: IAdminAssistantRuntimeOptions): boolean {
    return !!options?.listContent;
  }

  /** Listed page, or an empty page when the host wired no `listContent`. */
  static async listContent(
    options: IAdminAssistantRuntimeOptions,
    collection: IAssistantCollectionContext,
    query: { limit?: number; offset?: number; context?: Record<string, any> },
  ): Promise<{ docs: any[]; totalDocs?: number; limit?: number; offset?: number }> {
    const listContent = options?.listContent;
    if (!listContent) return { docs: [] };
    const result = await listContent(collection, query);
    return { ...result, docs: Array.isArray(result?.docs) ? result.docs : [] };
  }

  /** Installed plugins, or `[]` when the host exposes none. */
  static getPlugins(options: IAdminAssistantRuntimeOptions): IAssistantPluginContext[] {
    const getPlugins = options?.getPlugins;
    if (!getPlugins) return [];
    return getPlugins() || [];
  }

  /** Host prompt profile, or `{}` when the host supplies none. */
  static async resolvePromptProfile(
    options: IAdminAssistantRuntimeOptions,
    context: {
      collections: IAssistantCollectionContext[];
      plugins: IAssistantPluginContext[];
      tools: IAssistantToolSummary[];
    },
  ): Promise<IAssistantPromptProfile> {
    const resolve = options?.resolvePromptProfile;
    if (!resolve) return {};
    return (await Promise.resolve(resolve(context))) || {};
  }

  /** Host prompt copy, or `{}` when the host supplies none. */
  static async resolvePromptCopy(
    options: IAdminAssistantRuntimeOptions,
    context: {
      collections: IAssistantCollectionContext[];
      plugins: IAssistantPluginContext[];
      tools: IAssistantToolSummary[];
    },
  ): Promise<IAssistantPromptCopy> {
    const resolve = options?.resolvePromptCopy;
    if (!resolve) return {};
    return (await Promise.resolve(resolve(context))) || {};
  }
}
