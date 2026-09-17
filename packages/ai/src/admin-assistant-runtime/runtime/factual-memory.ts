import type { IAssistantSessionEntityMemory } from '@ai/admin-assistant-runtime/interfaces/assistant-session-entity-memory.interface';
import { FactualQueryHelpers } from '@ai/admin-assistant-runtime/runtime/factual-query-helpers';

/**
 * What a factual answer leaves behind for the next turn.
 *
 * A question like "how many orders?" is usually followed by one that depends on it — "show me the
 * last three" — so the answer is remembered along with what produced it. Kept separate from asking
 * the question because the memory outlives the turn that wrote it.
 */
export class FactualMemory {
  static buildFactualMemory(
    toolName: string,
    toolInput: Record<string, unknown> | undefined,
    output: Record<string, unknown>,
    primaryMetricPath: string,
    primitiveEntries: Array<{ path: string; value: string | number | boolean }>,
  ): IAssistantSessionEntityMemory['factual'] {
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

  static formatMemoryReply(
    message: string,
    factualMemory: NonNullable<IAssistantSessionEntityMemory['factual']>,
  ): string | null {
    const usable = (Array.isArray(factualMemory.metrics) ? factualMemory.metrics : [])
      .filter((entry): entry is { path: string; value: number } => typeof entry?.value === 'number' && Number.isFinite(entry.value));
    // The +14 "stick with what we were just discussing" bonus is for a VAGUE follow-up ("and last
    // month?"). If the message names any metric's own leaf token it is not vague, and the bonus was
    // strong enough to beat a direct hit — "what is the total?" against a stored
    // `primaryMetricPath: summary.transactionCount` answered with the transaction count (4+14) instead
    // of total revenue (12). `summary` is excluded: it is the container every path shares, not a name.
    const messageTokens = FactualQueryHelpers.tokenize(message);
    const namesAMetric = usable.some((entry) => FactualQueryHelpers
      .tokenize(String(entry.path || '').split('.').pop() || '')
      .some((token) => token !== 'summary' && messageTokens.includes(token)));
    const metrics = usable
      .map((entry) => ({
        ...entry,
        score: FactualQueryHelpers.scoreNumericEntry(entry.path, message)
          + (!namesAMetric && !FactualQueryHelpers.hasSpecificMetricSubject(message) && entry.path === String(factualMemory.primaryMetricPath || '').trim() ? 14 : 0),
      }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
    if (metrics.length === 0) return null;
    const primary = metrics[0];
    if (primary.score < 6) return null;
    const secondary = FactualQueryHelpers.hasSpecificMetricSubject(message)
      ? metrics.find((entry) => entry.path !== primary.path && entry.value !== primary.value && entry.score >= 4) || null
      : null;
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
