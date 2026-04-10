import { FactualQueryHelpers } from './factual-query-helpers';
import { FactualQueryToolService } from './factual-query-tool-service';
import type { RuntimeContext } from './types.types';
import type { AssistantSessionEntityMemory } from '../types';

export class FactualQueryService {
  static async resolveReply(
    context: RuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: AssistantSessionEntityMemory['factual'] } | null> {
    const followupReply = await FactualQueryService.resolveFollowupReply(context, message);
    if (followupReply) {
      return followupReply;
    }

    const pluginReply = await FactualQueryService.resolvePluginAccessReply(context, message);
    if (pluginReply) {
      return pluginReply;
    }

    return FactualQueryService.resolveReadOnlyDataReply(context, message);
  }

  private static async resolveFollowupReply(
    context: RuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: AssistantSessionEntityMemory['factual'] } | null> {
    const factualMemory = context.checkpoint?.memory?.factual;
    if (!factualMemory?.tool || !FactualQueryHelpers.looksLikeFactualFollowup(message)) {
      return null;
    }

    const inferredPeriod = FactualQueryHelpers.inferPeriod(message);
    if (inferredPeriod) {
      const nextInput = {
        ...(factualMemory.input && typeof factualMemory.input === 'object' ? factualMemory.input : {}),
        period: inferredPeriod,
      } as Record<string, any>;
      delete nextInput.from;
      delete nextInput.to;
      const result = await context.bridge.call({
        tool: factualMemory.tool,
        input: nextInput,
        context: { dryRun: true },
      });
      if (result?.ok) {
        const preferredMetricPath = FactualQueryHelpers.hasExplicitMetricTarget(message)
          ? ''
          : String(factualMemory.primaryMetricPath || '').trim();
        const formatted = FactualQueryService.formatToolOutput(
          message,
          factualMemory.tool,
          result.output,
          nextInput,
          preferredMetricPath,
        );
        if (formatted) {
          return {
            message: formatted.message,
            model: 'tool-factual-followup',
            memory: formatted.memory,
          };
        }
      }
    }

    const metricReply = FactualQueryService.formatMemoryReply(message, factualMemory);
    if (!metricReply) {
      return null;
    }

    return {
      message: metricReply,
      model: 'tool-factual-followup',
      memory: factualMemory,
    };
  }

  private static async resolvePluginAccessReply(
    context: RuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: AssistantSessionEntityMemory['factual'] } | null> {
    if (!/\b(can you access|do you have access|can you use|can you see|do you see|is .* available|is .* enabled|is .* installed)\b/i.test(message)) {
      return null;
    }

    const plugin = FactualQueryToolService.matchPlugin(context, message);
    if (!plugin) {
      return null;
    }

    const infoTool = `plugins.api.${plugin.slug}.info`;
    if (!FactualQueryToolService.hasTool(context, infoTool)) {
      return {
        message: `Yes. \`${plugin.slug}\` is ${String(plugin.state || 'unknown').trim() || 'unknown'}.`,
        model: 'plugin-access-static',
      };
    }

    const result = await context.bridge.call({ tool: infoTool, input: {}, context: { dryRun: true } });
    if (!result?.ok) {
      return {
        message: `I can see \`${plugin.slug}\`, but I could not inspect it right now.`,
        model: 'plugin-access-fallback',
      };
    }

    const output = result.output && typeof result.output === 'object' ? result.output : {};
    const methods = Array.isArray((output as any)?.autoExposedMethods)
      ? (output as any).autoExposedMethods.map((item: any) => String(item || '').trim()).filter(Boolean)
      : [];
    const state = String((output as any)?.state || plugin.state || 'unknown').trim() || 'unknown';

    return {
      message: methods.length > 0
        ? `Yes. \`${plugin.slug}\` is ${state}, and I can query it directly. Available read methods include ${methods.slice(0, 5).join(', ')}.`
        : `Yes. \`${plugin.slug}\` is ${state}. I can inspect its metadata and collections.`,
      model: 'plugin-access',
    };
  }

  private static async resolveReadOnlyDataReply(
    context: RuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: AssistantSessionEntityMemory['factual'] } | null> {
    if (!FactualQueryHelpers.looksLikeReadOnlyDataQuestion(message)) {
      return null;
    }

    const toolCandidates = FactualQueryToolService.rankReadOnlyTools(context, message).slice(0, 4);
    const toolInput = FactualQueryHelpers.buildToolInput(message);

    for (const tool of toolCandidates) {
      const result = await context.bridge.call({ tool: tool.tool, input: toolInput, context: { dryRun: true } });
      if (!result?.ok) {
        continue;
      }

      const formatted = FactualQueryService.formatToolOutput(message, tool.tool, result.output, toolInput);
      if (formatted) {
        return {
          message: formatted.message,
          model: 'tool-factual',
          memory: formatted.memory,
        };
      }
    }

    return null;
  }

  private static formatToolOutput(
    message: string,
    toolName: string,
    output: unknown,
    toolInput?: Record<string, unknown>,
    preferredMetricPath?: string,
  ): { message: string; memory?: AssistantSessionEntityMemory['factual'] } | null {
    if (typeof output === 'string') {
      const value = output.trim();
      return value
        ? {
            message: value,
            memory: {
              tool: toolName,
              input: toolInput,
            },
          }
        : null;
    }
    if (!output || typeof output !== 'object') {
      return null;
    }
    const outputObject = output as Record<string, unknown>;

    const range = (outputObject as any)?.range && typeof (outputObject as any).range === 'object'
      ? (outputObject as any).range
      : null;
    const rangeText = FactualQueryHelpers.formatRange(range);
    const currency = String((outputObject as any)?.currency || '').trim() || undefined;

    if (/\baccess\b/i.test(message) && !/\b(how much|total|summary|stats|count|number|report|overview|revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount)\b/i.test(message)) {
      return {
        message: `Yes. I can access data through a read-only plugin tool${rangeText ? ` for ${rangeText}` : ''}.`,
        memory: FactualQueryService.buildFactualMemory(toolName, toolInput, outputObject, '', []),
      };
    }

    const primitiveEntries = FactualQueryHelpers.collectPrimitiveEntries(outputObject);
    const numericEntries = primitiveEntries
      .filter((entry): entry is { path: string; value: number } => typeof entry.value === 'number' && Number.isFinite(entry.value))
      .map((entry) => ({
        ...entry,
        score: FactualQueryHelpers.scoreNumericEntry(entry.path, message)
          + (preferredMetricPath && entry.path === preferredMetricPath ? 14 : 0),
      }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

    if (numericEntries.length > 0) {
      const primary = numericEntries[0];
      const secondary = numericEntries.find((entry) =>
        entry.path !== primary.path &&
        entry.score >= 4 &&
        !(/\b(how many|now many|count|number)\b/i.test(message) && FactualQueryHelpers.isSubCountLikePath(entry.path)),
      ) || null;
      const intro = rangeText ? `For ${rangeText}, ` : '';
      const primaryText = `${FactualQueryHelpers.humanizePath(primary.path)} is ${FactualQueryHelpers.formatValue(primary.path, primary.value, currency)}.`;
      const secondaryText = secondary
        ? ` ${FactualQueryHelpers.humanizePath(secondary.path)} is ${FactualQueryHelpers.formatValue(secondary.path, secondary.value, currency)}.`
        : '';
      return {
        message: `${intro}${primaryText}${secondaryText}`.trim(),
        memory: FactualQueryService.buildFactualMemory(toolName, toolInput, outputObject, primary.path, primitiveEntries),
      };
    }

    if (Array.isArray((outputObject as any)?.publicApiMethods)) {
      const methods = ((outputObject as any).publicApiMethods as any[])
        .map((item: any) => String(item || '').trim())
        .filter(Boolean);
      if (methods.length > 0) {
        return {
          message: `I can inspect this plugin. Available public methods include ${methods.slice(0, 5).join(', ')}.`,
          memory: FactualQueryService.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
        };
      }
    }

    const keys = Object.keys(outputObject).slice(0, 5);
    if (keys.length > 0) {
      return {
        message: `I found data from a read-only tool. Available fields include ${keys.join(', ')}.`,
        memory: FactualQueryService.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
      };
    }

    return {
      message: `I found data through ${FactualQueryHelpers.humanizeToolName(toolName)}.`,
      memory: FactualQueryService.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
    };
  }

  private static buildFactualMemory(
    toolName: string,
    toolInput: Record<string, unknown> | undefined,
    output: Record<string, unknown>,
    primaryMetricPath: string,
    primitiveEntries: Array<{ path: string; value: string | number | boolean }>,
  ): AssistantSessionEntityMemory['factual'] {
    const range = output?.range && typeof output.range === 'object' ? output.range as Record<string, unknown> : {};
    return {
      tool: toolName,
      input: toolInput && typeof toolInput === 'object' ? { ...toolInput } : undefined,
      rangeLabel: String(range?.label || '').trim() || undefined,
      rangeFrom: String(range?.from || '').trim() || undefined,
      rangeTo: String(range?.to || '').trim() || undefined,
      currency: String(output?.currency || '').trim() || undefined,
      primaryMetricPath: String(primaryMetricPath || '').trim() || undefined,
      metrics: primitiveEntries.slice(0, 24),
    };
  }

  private static formatMemoryReply(
    message: string,
    factualMemory: NonNullable<AssistantSessionEntityMemory['factual']>,
  ): string | null {
    const metrics = (Array.isArray(factualMemory.metrics) ? factualMemory.metrics : [])
      .filter((entry): entry is { path: string; value: number } => typeof entry?.value === 'number' && Number.isFinite(entry.value))
      .map((entry) => ({
        ...entry,
        score: FactualQueryHelpers.scoreNumericEntry(entry.path, message),
      }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
    if (metrics.length === 0) {
      return null;
    }

    const primary = metrics[0];
    const secondary = metrics.find((entry) => entry.path !== primary.path && entry.score >= 0) || null;
    const rangeText = FactualQueryHelpers.formatRange({
      label: factualMemory.rangeLabel,
      from: factualMemory.rangeFrom,
      to: factualMemory.rangeTo,
    });
    const intro = rangeText ? `For ${rangeText}, ` : '';
    const primaryText = `${FactualQueryHelpers.humanizePath(primary.path)} is ${FactualQueryHelpers.formatValue(primary.path, primary.value, factualMemory.currency)}.`;
    const secondaryText = secondary
      ? ` ${FactualQueryHelpers.humanizePath(secondary.path)} is ${FactualQueryHelpers.formatValue(secondary.path, secondary.value, factualMemory.currency)}.`
      : '';
    return `${intro}${primaryText}${secondaryText}`.trim();
  }
}
