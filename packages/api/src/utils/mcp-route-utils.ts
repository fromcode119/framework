import { McpWirePaths } from '@fromcode119/mcp';

/**
 * Where the MCP surface is mounted, and whether a request is headed there.
 *
 * The path lives here rather than as a literal in each caller, so the router and the CSRF exemption
 * cannot drift apart — a mismatch would silently reinstate CSRF on a token-only route.
 */
export class McpRouteUtils {
  static readonly BASE_PATH = McpWirePaths.BASE;

  /**
   * MCP routes are token-only and stateless: `AuthManager.requireApiToken()` rejects session cookies,
   * so there is no cookie-borne authority for a cross-site form post to ride on — the condition CSRF
   * protection exists to defend. Without this exemption a caller that simply forgot its key gets
   * "Invalid CSRF token" instead of a 401, sending a machine client after the wrong problem.
   */
  static isMcpPath(pathname: string): boolean {
    const path = String(pathname || '');
    if (!path) return false;
    return path === McpRouteUtils.BASE_PATH
      || path.startsWith(`${McpRouteUtils.BASE_PATH}/`)
      || path.includes(`${McpRouteUtils.BASE_PATH}/`);
  }
}
