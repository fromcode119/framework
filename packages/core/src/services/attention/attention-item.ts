import { CoercionUtils } from '@core/utils/coercion-utils';
import { AttentionSeverity } from '@core/services/attention/attention-severity.enum';

/**
 * One thing that needs the operator, from core or from a plugin.
 *
 * Deliberately small: a sentence, how bad it is, and where to go. No counts that nobody acts on, no
 * metric — if there is nothing to DO about it, it does not belong on this list, it belongs in a
 * report. The action label and href come from whoever raised it, because only they know where the
 * fixing happens.
 */
export class AttentionItem {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly severity: AttentionSeverity;
  readonly actionLabel: string;
  readonly actionPath: string;
  /** Which site this concerns; empty on a platform-wide item. */
  readonly siteHost: string;
  readonly source: string;

  private constructor(input: {
    key: string; title: string; detail: string; severity: AttentionSeverity;
    actionLabel: string; actionPath: string; siteHost: string; source: string;
  }) {
    this.key = input.key;
    this.title = input.title;
    this.detail = input.detail;
    this.severity = input.severity;
    this.actionLabel = input.actionLabel;
    this.actionPath = input.actionPath;
    this.siteHost = input.siteHost;
    this.source = input.source;
  }

  /** Returns null when the shape is unusable — a provider that returns rubbish is skipped, not trusted. */
  static from(raw: unknown, source: string): AttentionItem | null {
    const input = (raw || {}) as Record<string, unknown>;
    const title = CoercionUtils.toString(input.title).trim();
    const key = CoercionUtils.toString(input.key).trim();
    if (!title || !key) return null;

    return new AttentionItem({
      key: `${source}:${key}`,
      title,
      detail: CoercionUtils.toString(input.detail).trim(),
      severity: AttentionSeverity.resolve(input.severity),
      actionLabel: CoercionUtils.toString(input.actionLabel).trim(),
      actionPath: CoercionUtils.toString(input.actionPath).trim(),
      siteHost: CoercionUtils.toString(input.siteHost).trim(),
      source,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      key: this.key,
      title: this.title,
      detail: this.detail,
      severity: this.severity.value,
      actionLabel: this.actionLabel,
      actionPath: this.actionPath,
      siteHost: this.siteHost,
      source: this.source,
    };
  }
}
