import type { ReactNode } from 'react';
import { McpRemoteAccessPanel } from '@/app/settings/integrations/mcp/components/view/mcp-remote-access-panel.client';
import { McpTokensPanel } from '@/app/settings/integrations/mcp/components/view/mcp-tokens-panel.client';

/**
 * Extra panels an integration type may contribute below its provider grid.
 *
 * A REGISTRY, not a chain of `if (activeType === …)` in the page: the integrations page stays generic
 * and each type owns whatever it needs beyond providers-and-fields. MCP needs it because access
 * tokens are created RECORDS with a secret shown once — they are not config fields, so they cannot be
 * expressed as a provider form, but they belong on the same screen as the thing they grant access to.
 */
export class IntegrationExtraPanels {
  private static readonly PANELS: Record<string, () => ReactNode> = {
    mcp: () => (
      <>
        <McpRemoteAccessPanel />
        <McpTokensPanel />
      </>
    ),
  };

  static render(activeType: string): ReactNode {
    const panel = IntegrationExtraPanels.PANELS[String(activeType || '')];
    return panel ? panel() : null;
  }
}
