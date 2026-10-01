/** What the site's text-message provider does: send one message, or say it cannot. */
export interface ISmsSender {
  /** False for "Not set up": the site has chosen no provider, so nothing is sent. */
  readonly configured: boolean;
  /** Send `body` to `to` (an E.164 number). Resolves with the provider's message id; throws on refusal. */
  send(message: { to: string; body: string }): Promise<{ id: string }>;
}
