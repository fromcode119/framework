import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import type { IRuntimeRetrievalResult } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-retrieval-result.interface';
import type { IRuntimeToolCall } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-tool-call.interface';
import type { IRuntimeToolResult } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-tool-result.interface';
import { RuntimeUtils } from '@ai/admin-assistant-runtime/runtime/types';
import { RetrievalHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/retrieval-helpers';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';

export class RetrievalRunner {
  static async runRetrieval(
  context: IRuntimeContext,
  intent: IRuntimeIntent,
): Promise<IRuntimeRetrievalResult> {
      const availableToolNames = RetrievalHelpers.toolSetFromContext(context);
      const queryHints: string[] = [];
      const allCalls: IRuntimeToolCall[] = [];
      const allResults: IRuntimeToolResult[] = [];
      const blocked = new Set<string>();
      let passes = 0;

      if (intent.kind === RuntimeIntentKind.REPLACE_TEXT) {
        const firstPassCalls = [...RetrievalHelpers.buildReplaceCalls(intent), ...RetrievalHelpers.buildUrlHintCalls(intent)];
        const dedupedFirstPass = Array.from(
          new Map(firstPassCalls.map((call) => [`${call.tool}:${JSON.stringify(call.input || {})}`, call])).values(),
        );
        const firstRun = RetrievalHelpers.withAllowedTools(dedupedFirstPass, context);
        firstRun.blocked.forEach((tool) => blocked.add(tool));
        for (const call of firstRun.runnable) {
          allCalls.push(call);
          const result = await RetrievalRunner.callToolSafe(context, call);
          allResults.push(result);
        }
        passes += 1;

        const matched = RetrievalHelpers.totalMatches(allResults);
        const refinedQueries = RetrievalHelpers.deriveRefinedQueries(intent);
        queryHints.push(...refinedQueries);

        if (matched === 0 && refinedQueries.length > 0) {
          const secondPassCalls = refinedQueries
            .slice(0, 3)
            .flatMap((query) => RetrievalHelpers.buildReplaceCallsForQuery(query));
          const dedupedSecondPass = Array.from(
            new Map(secondPassCalls.map((call) => [`${call.tool}:${JSON.stringify(call.input || {})}`, call])).values(),
          ).filter((call) => !allCalls.some((seen) => seen.tool === call.tool && JSON.stringify(seen.input || {}) === JSON.stringify(call.input || {})));
          const secondRun = RetrievalHelpers.withAllowedTools(dedupedSecondPass, context);
          secondRun.blocked.forEach((tool) => blocked.add(tool));
          for (const call of secondRun.runnable) {
            allCalls.push(call);
            const result = await RetrievalRunner.callToolSafe(context, call);
            allResults.push(result);
          }
          if (secondRun.runnable.length > 0 || secondRun.blocked.length > 0) {
            passes += 1;
          }
        }
      }

      const matchCount = RetrievalHelpers.totalMatches(allResults);
      return {
        stage: RuntimeStage.RETRIEVE,
        confidence: RetrievalHelpers.estimateRetrievalConfidence(matchCount, blocked.size),
        queryHints: Array.from(new Set(queryHints)),
        passes: Math.max(1, passes),
        calls: allCalls,
        results: allResults,
        blockedTools: Array.from(blocked),
        availableToolNames,
      };

  }

  private static async callToolSafe(
    context: IRuntimeContext,
    call: IRuntimeToolCall,
  ): Promise<IRuntimeToolResult> {
    const normalizedInput = call.input && typeof call.input === 'object' ? { ...call.input } : {};
    try {
      const raw = await context.bridge.call({
        tool: call.tool,
        input: normalizedInput,
        context: { dryRun: true },
      });
      const normalized = RuntimeUtils.normalizeToolResult(raw);
      return {
        tool: call.tool,
        input: normalizedInput,
        ok: normalized.ok,
        output: normalized.output,
        error: normalized.error,
      };
    } catch (error: any) {
      return {
        tool: call.tool,
        input: normalizedInput,
        ok: false,
        error: String(error?.message || 'Tool call failed'),
      };
    }
  }
}
