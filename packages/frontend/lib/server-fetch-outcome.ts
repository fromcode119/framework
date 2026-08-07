import { ServerApiUnreachableError } from '@/lib/server-api-unreachable-error';

/**
 * The result of a server-side API fetch, keeping two states that used to collapse into a bare
 * `null` strictly apart:
 *
 * - **answered** — the API responded. `value` may still be `null`, which genuinely means
 *   "there is no such document".
 * - **unreachable** — the API could not be reached (DNS failure, connect timeout, socket
 *   reset, abort). Nothing is known about whether the document exists.
 *
 * Collapsing the second into the first is what turned a momentary transport blip into a hard
 * 404 on a published page. Callers that render content decide per surface: content routes use
 * {@link valueOrThrow} so an unreachable API surfaces as a 5xx, while genuinely decorative
 * surfaces (theme assets, prefetch hints) may keep degrading through {@link value}.
 */
export class ServerFetchOutcome<TValue> {
  private constructor(
    private readonly answered: boolean,
    private readonly payload: TValue | null,
    private readonly failure: unknown,
  ) {}

  /** The API answered. A `null` value here is a real "no such document". */
  static resolved<TValue>(value: TValue | null): ServerFetchOutcome<TValue> {
    return new ServerFetchOutcome<TValue>(true, value, null);
  }

  /** The API could not be reached — existence of the document is unknown. */
  static unreachable<TValue>(error: unknown): ServerFetchOutcome<TValue> {
    return new ServerFetchOutcome<TValue>(false, null, error);
  }

  get isUnreachable(): boolean {
    return !this.answered;
  }

  /** The payload, or `null` for both "no such document" and "unreachable" — check {@link isUnreachable} first. */
  get value(): TValue | null {
    return this.payload;
  }

  get error(): unknown {
    return this.failure;
  }

  /**
   * The payload when the API answered; throws {@link ServerApiUnreachableError} when it did
   * not. This is the call that stops a transport failure from being rendered as a 404.
   */
  valueOrThrow(requestPath: string): TValue | null {
    if (this.answered) {
      return this.payload;
    }
    throw new ServerApiUnreachableError(requestPath, this.failure);
  }

  /** Re-wraps this outcome around a derived value, preserving the answered/unreachable state. */
  withValue<TNext>(value: TNext | null): ServerFetchOutcome<TNext> {
    return this.answered ? ServerFetchOutcome.resolved<TNext>(value) : ServerFetchOutcome.unreachable<TNext>(this.failure);
  }
}
