import type { AssistantAction } from '../types';
import { RuntimeUtils } from './types';
import type { RuntimeIntent, RuntimeRetrievalResult } from './types.types';
import { ActionHelpers } from './helpers/action-helpers';

export class ActionBuilder {
  static buildReplaceActions(intent: RuntimeIntent, retrieval: RuntimeRetrievalResult): AssistantAction[] {
      const from = String(intent.replace?.from || '').trim();
      const to = String(intent.replace?.to || '').trim();
      if (!from || !to) return [];

      const grouped = ActionHelpers.collectMatchesByTool(retrieval);
      const contentActions = ActionHelpers.stageContentUpdates(grouped.get('content.search_text') || [], from, to);
      const pluginConfigActions = ActionHelpers.stageConfigUpdates(
        'plugins.settings.update',
        grouped.get('plugins.settings.search_text') || [],
        from,
        to,
      );
      const themeConfigActions = ActionHelpers.stageConfigUpdates(
        'themes.config.update',
        grouped.get('themes.config.search_text') || [],
        from,
        to,
      );

      const preferManaged = contentActions.length + pluginConfigActions.length + themeConfigActions.length > 0;
      const pluginFileActions = preferManaged
        ? []
        : ActionHelpers.stageFileUpdates('plugins.files.replace_text', grouped.get('plugins.files.search_text') || [], from, to);
      const themeFileActions = preferManaged
        ? []
        : ActionHelpers.stageFileUpdates('themes.files.replace_text', grouped.get('themes.files.search_text') || [], from, to);

      const actions = [
        ...contentActions,
        ...pluginConfigActions,
        ...themeConfigActions,
        ...pluginFileActions,
        ...themeFileActions,
      ];

      return Array.from(new Map(actions.map((action) => [JSON.stringify(action), action])).values());

  }

  static summarizeReplaceEvidence(retrieval: RuntimeRetrievalResult): { totalMatches: number; byTool: Record<string, number> } {
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