import { TextHelpers } from './helpers/text-helpers';
import { FactualQueryHelpers } from './factual-query-helpers';
import type { RuntimeContext } from './types.types';

export class FactualQueryToolService {
  static rankReadOnlyTools(
    context: RuntimeContext,
    message: string,
  ): Array<{ tool: string; description: string; score: number }> {
    const plugin = FactualQueryToolService.matchPlugin(context, message);
    const queryTokens = FactualQueryHelpers.tokenize(message);
    const mentionsBusinessMetric = /\b(revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount)\b/.test(TextHelpers.normalize(message));
    const asksForEntityDetail = FactualQueryHelpers.looksLikeEntityDetailQuestion(message);

    return (Array.isArray(context.tools) ? context.tools : [])
      .map((tool: any) => ({
        tool: String(tool?.tool || '').trim(),
        description: String(tool?.description || '').trim(),
        readOnly: tool?.readOnly === true,
      }))
      .filter((tool) => tool.readOnly && !!tool.tool)
      .map((tool) => ({
        tool: tool.tool,
        description: tool.description,
        score: FactualQueryToolService.scoreReadOnlyTool(tool, queryTokens, plugin, mentionsBusinessMetric, asksForEntityDetail),
      }))
      .filter((tool) => tool.score > 0)
      .sort((left, right) => right.score - left.score || left.tool.localeCompare(right.tool));
  }

  static matchPlugin(context: RuntimeContext, message: string): any | null {
    const token = TextHelpers.normalizeToken(message);
    const plugins = Array.isArray(context.workspaceMap?.plugins) ? context.workspaceMap.plugins : [];
    let best: any | null = null;
    let bestScore = 0;

    for (const plugin of plugins) {
      const aliases = [
        TextHelpers.normalizeToken(String(plugin?.slug || '')),
        TextHelpers.normalizeToken(String(plugin?.name || '')),
      ].filter(Boolean);
      for (const alias of aliases) {
        if (alias && token.includes(alias) && alias.length > bestScore) {
          best = plugin;
          bestScore = alias.length;
        }
      }
    }

    return best;
  }

  static hasTool(context: RuntimeContext, toolName: string): boolean {
    return (Array.isArray(context.tools) ? context.tools : [])
      .some((tool: any) => String(tool?.tool || '').trim() === toolName);
  }

  private static scoreReadOnlyTool(
    tool: { tool: string; description: string },
    queryTokens: string[],
    plugin: any | null,
    mentionsBusinessMetric: boolean,
    asksForEntityDetail: boolean,
  ): number {
    const haystack = TextHelpers.normalize(`${tool.tool} ${tool.description}`);
    let score = 0;

    for (const token of queryTokens) {
      if (token.length >= 3 && haystack.includes(token)) {
        score += 6;
      }
    }

    if (plugin) {
      const pluginAliases = [
        TextHelpers.normalize(String(plugin?.slug || '')),
        TextHelpers.normalize(String(plugin?.name || '')),
      ].filter(Boolean);
      for (const alias of pluginAliases) {
        if (alias && haystack.includes(alias)) {
          score += 12;
        }
      }
    }

    if (/^plugins\.api\.[^.]+\.info$/.test(tool.tool)) {
      score -= 8;
    }
    if (/\b(summary|stats?|report|overview|totals?)\b/.test(haystack)) {
      score += 8;
    }
    if (asksForEntityDetail && /\b(summary|stats?|report|overview|totals?)\b/.test(haystack)) {
      score -= 20;
    }
    if (asksForEntityDetail && /\b(list|search|find|lookup|detail|record|records|transaction|transactions|order|orders|item|items)\b/.test(haystack)) {
      score += 18;
    }
    if (mentionsBusinessMetric && /\b(finance|payment|invoice|transaction|wallet|refund|order|sales|revenue|balance)\b/.test(haystack)) {
      score += 10;
    }
    if (mentionsBusinessMetric && /\.(get|summary|stats|report)(?:$|\.)/.test(tool.tool)) {
      score += 5;
    }
    if (/^web\./.test(tool.tool)) {
      score -= 4;
    }

    return score;
  }
}
