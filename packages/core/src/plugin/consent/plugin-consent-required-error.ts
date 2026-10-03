import type { IPluginConsentSummary } from '@core/plugin/consent/interfaces/plugin-consent-summary.interface';

/**
 * Refuses to run a plugin that asks for something nobody approved. Carries the summary, so the console
 * can open the consent dialog on exactly what is missing instead of showing an error.
 */
export class PluginConsentRequiredError extends Error {
  static readonly CODE = 'PLUGIN_CONSENT_REQUIRED';
  readonly code = PluginConsentRequiredError.CODE;
  readonly statusCode = 409;

  constructor(readonly summary: IPluginConsentSummary, message?: string) {
    super(message || `Plugin "${summary.slug}" needs approval for: ${summary.entries.filter((entry) => entry.isNew).map((entry) => entry.entry).join(', ')}.`);
  }

  static is(error: unknown): error is PluginConsentRequiredError {
    return (error as { code?: unknown } | null)?.code === PluginConsentRequiredError.CODE;
  }
}
