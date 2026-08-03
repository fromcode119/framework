import type { IContentResolutionGateOptions } from '@core/services/interfaces/content-resolution-gate-options.interface';
import type { ContentResolutionResult } from '@core/services/content-resolution-result';

/**
 * A plugin-supplied transformer applied to a resolved document before it leaves the server.
 * `null` in or out means "no document" — a call-signature contract, so this stays an `interface`.
 */
export interface IContentResolutionGate {
  (
    result: ContentResolutionResult | null,
    options: IContentResolutionGateOptions,
  ): Promise<ContentResolutionResult | null> | ContentResolutionResult | null;
}
