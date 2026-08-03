import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import { RuntimeUtils } from '@ai/admin-assistant-runtime/runtime/types';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import type { IRuntimeRetrievalResult } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-retrieval-result.interface';
import { ActionHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/action-helpers';
import { ScopedSearchTool } from '@ai/admin-assistant-runtime/enums/scoped-search-tool.enum';

export class ActionBuilder {
  static buildReplaceActions(intent: IRuntimeIntent, retrieval: IRuntimeRetrievalResult): IAssistantAction[] {
      const from = String(intent.replace?.from || '').trim();
      const to = String(intent.replace?.to || '').trim();
      if (!from || !to) return [];

      const grouped = ActionHelpers.collectMatchesByTool(retrieval);
      const contentActions = ActionHelpers.stageContentUpdates(grouped.get('content.search_text') || [], from, to);
      // The scope's search AND update tool both come from the SAME enum member, so a staged write can
      // never land in the other scope (a mismatch here silently rewrote theme config as plugin config).
      const stageConfig = (scope: ScopedSearchTool): IAssistantAction[] =>
        ActionHelpers.stageConfigUpdates(scope.updateTool, grouped.get(scope.value) || [], from, to);
      const pluginConfigActions = stageConfig(ScopedSearchTool.PLUGIN_CONFIG);
      const themeConfigActions = stageConfig(ScopedSearchTool.THEME_CONFIG);

      const preferManaged = contentActions.length + pluginConfigActions.length + themeConfigActions.length > 0;
      const stageFiles = (scope: ScopedSearchTool): IAssistantAction[] =>
        preferManaged ? [] : ActionHelpers.stageFileUpdates(scope.updateTool, grouped.get(scope.value) || [], from, to);
      const pluginFileActions = stageFiles(ScopedSearchTool.PLUGIN_FILES);
      const themeFileActions = stageFiles(ScopedSearchTool.THEME_FILES);

      const actions = [
        ...contentActions,
        ...pluginConfigActions,
        ...themeConfigActions,
        ...pluginFileActions,
        ...themeFileActions,
      ];

      return Array.from(new Map(actions.map((action) => [JSON.stringify(action), action])).values());

  }

  static summarizeReplaceEvidence(retrieval: IRuntimeRetrievalResult): { totalMatches: number; byTool: Record<string, number> } {
    const byTool: Record<string, number> = {};
    let totalMatches = 0;
    for (const result of retrieval.results) {
      const matches = RuntimeUtils.listMatchesFromToolOutput(result.output || {});
      const count = matches.length;
      byTool[result.tool] = count;
      totalMatches += count;
    }
    return { totalMatches, byTool };
  }
}