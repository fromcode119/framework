import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

/**
 * Model Context Protocol — how external AI clients reach this installation's tools.
 *
 * DELIBERATELY NO PROVIDERS. `providers` is optional on the definition, and MCP has nothing to
 * configure per-provider today: access is token-only, and a token is a created record with a secret
 * shown once — not a config field. The screen's content is the token list, contributed as an extra
 * panel.
 *
 * An earlier version declared a single `local` provider carrying just an `enabled` toggle. That was a
 * mistake twice over: the toggle was stored and never read (a control with nothing behind it), and
 * `removeProvider` refuses to delete the last provider, so the operator was stuck with a row they
 * could not get rid of and that did nothing.
 *
 * When the hosted SSE transport lands it becomes a real provider — with a real endpoint and real
 * settings — and this list stops being empty for a reason, rather than to satisfy the shape.
 */
export class McpIntegrationDefinition {
  static readonly definition: IIntegrationTypeDefinition = {
    key: 'mcp',
    label: 'MCP (Model Context Protocol)',
    description: 'How external AI clients reach this installation’s tools. Access is token-only and every call is scoped to the tools its token names.',
    defaultProvider: '',
    providers: [],
  };
}
