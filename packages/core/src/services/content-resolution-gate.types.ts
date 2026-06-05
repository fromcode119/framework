/**
 * Types for the content-resolution gate registry.
 *
 * A "gate" is a plugin-supplied transformer applied to a resolved CMS/plugin
 * document before it leaves the server. The framework holds NO knowledge of what
 * any gate does (subscriptions, paywalls, geo-fencing, …) — it only runs the
 * registered transformers in sequence and returns the final result.
 */

export type ContentResolutionResult = { type: string; plugin: string; doc: any } | null;

export type ContentResolutionGateOptions = { user?: any; preview?: boolean };

export type ContentResolutionGate = (
  result: ContentResolutionResult,
  options: ContentResolutionGateOptions,
) => Promise<ContentResolutionResult> | ContentResolutionResult;
