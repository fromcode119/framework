import type { RuntimeContext, RuntimeIntent, RuntimeRetrievalResult, RuntimeToolCall, RuntimeToolResult } from './types.types';
import { RuntimeUtils } from './types';
import { RetrievalHelpers } from './helpers/retrieval-helpers';

export class RetrievalRunner {
  static async runRetrieval(
  context: RuntimeContext,
  intent: RuntimeIntent,
): Promise<RuntimeRetrievalResult> {
      const availableToolNames = RetrievalHelpers.toolSetFromContext(context);
      const queryHints: string[] = [];
      const allCalls: RuntimeToolCall[] = [];
      const allResults: RuntimeToolResult[] = [];
      const blocked = new Set<string>();
      let passes = 0;

      if (intent.kind === 'replace_text') {
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
        stage: 'retrieve',
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
    context: RuntimeContext,
    call: RuntimeToolCall,
  ): Promise<RuntimeToolResult> {
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
