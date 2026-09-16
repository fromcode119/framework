/**
 * Automatic issuance was requested for a host, but this deployment cannot do it right now.
 *
 * A DIFFERENT kind of refusal from {@link CertificateValidationError}: nothing was pasted wrong,
 * there is nothing to validate — the platform itself has no authority configured, or its gateway
 * isn't terminating TLS. The admin already hides the control when this is true (`automation.isAvailable`),
 * so reaching this is either a direct API call or a race with the deployment's own state changing —
 * either way it is an expected, well-formed refusal, not a server fault, and must not be logged or
 * answered as one.
 */
export class CertificateAutomationUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CertificateAutomationUnavailableError';
  }
}
