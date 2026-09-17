import { FactualQueryHelpers } from '@ai/admin-assistant-runtime/runtime/factual-query-helpers';
import { FactualQueryToolService } from '@ai/admin-assistant-runtime/runtime/factual-query-tool-service';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IAssistantSessionEntityMemory } from '@ai/admin-assistant-runtime/interfaces/assistant-session-entity-memory.interface';
import { FactualMemory } from '@ai/admin-assistant-runtime/runtime/factual-memory';

export class FactualQueryService {
  static async resolveReply(
    context: IRuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: IAssistantSessionEntityMemory['factual'] } | null> {
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
    context: IRuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: IAssistantSessionEntityMemory['factual'] } | null> {
    const factualMemory = context.checkpoint?.memory?.factual;
    if (!factualMemory?.tool || !FactualQueryHelpers.looksLikeFactualFollowup(message)) {
      return null;
    }

    const inferredPeriod = FactualQueryHelpers.inferPeriod(message);
    if (
      FactualQueryHelpers.looksLikeEntityDetailQuestion(message)
      || (!inferredPeriod && !FactualQueryHelpers.hasExplicitMetricTarget(message))
    ) {
      return null;
    }
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
        const preferredMetricPath = FactualQueryHelpers.hasSpecificMetricSubject(message)
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

    const metricReply = FactualMemory.formatMemoryReply(message, factualMemory);
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
    context: IRuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: IAssistantSessionEntityMemory['factual'] } | null> {
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
    context: IRuntimeContext,
    message: string,
  ): Promise<{ message: string; model: string; memory?: IAssistantSessionEntityMemory['factual'] } | null> {
    if (!FactualQueryHelpers.looksLikeReadOnlyDataQuestion(message) || FactualQueryHelpers.looksLikeEntityDetailQuestion(message)) {
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
  ): { message: string; memory?: IAssistantSessionEntityMemory['factual'] } | null {
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
        memory: FactualMemory.buildFactualMemory(toolName, toolInput, outputObject, '', []),
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
      const secondary = FactualQueryHelpers.hasSpecificMetricSubject(message)
        ? numericEntries.find((entry) =>
            entry.path !== primary.path &&
            entry.value !== primary.value &&
            entry.score >= 4 &&
            !(/\b(how many|now many|count|number)\b/i.test(message) && FactualQueryHelpers.isSubCountLikePath(entry.path)),
          ) || null
        : null;
      const intro = rangeText ? `For ${rangeText}, ` : '';
      const primaryText = `${FactualQueryHelpers.humanizePath(primary.path)} is ${FactualQueryHelpers.formatValue(primary.path, primary.value, currency)}.`;
      const secondaryText = secondary
        ? ` ${FactualQueryHelpers.humanizePath(secondary.path)} is ${FactualQueryHelpers.formatValue(secondary.path, secondary.value, currency)}.`
        : '';
      return {
        message: `${intro}${primaryText}${secondaryText}`.trim(),
        memory: FactualMemory.buildFactualMemory(toolName, toolInput, outputObject, primary.path, primitiveEntries),
      };
    }

    if (Array.isArray((outputObject as any)?.publicApiMethods)) {
      const methods = ((outputObject as any).publicApiMethods as any[])
        .map((item: any) => String(item || '').trim())
        .filter(Boolean);
      if (methods.length > 0) {
        return {
          message: `I can inspect this plugin. Available public methods include ${methods.slice(0, 5).join(', ')}.`,
          memory: FactualMemory.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
        };
      }
    }

    const keys = Object.keys(outputObject).slice(0, 5);
    if (keys.length > 0) {
      return {
        message: `I found data from a read-only tool. Available fields include ${keys.join(', ')}.`,
        memory: FactualMemory.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
      };
    }

    return {
      message: `I found data through ${FactualQueryHelpers.humanizeToolName(toolName)}.`,
      memory: FactualMemory.buildFactualMemory(toolName, toolInput, outputObject, '', primitiveEntries),
    };
  }

}