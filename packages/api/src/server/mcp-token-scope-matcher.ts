/**
 * Matches a token's scope globs against a tool name.
 *
 * A scope can only ever NARROW what its user could already do — the tool's own `permission` is checked
 * separately against the user's roles, and both must pass. An empty scope list means "not narrowed",
 * which is what every token issued before scopes existed carries.
 */
export class McpTokenScopeMatcher {
  static allows(scopes: string[] | null | undefined, tool: string): boolean {
    const target = String(tool || '').trim();
    if (!target) return false;

    // No list at all — a token issued before scopes existed, or one deliberately left unnarrowed.
    if (!Array.isArray(scopes) || !scopes.length) return true;

    // A list WAS provided, so the operator intended to narrow. If every entry is blank the intent
    // cannot be honoured, and the safe reading of a malformed restriction is "deny", never "allow
    // everything" — otherwise a typo'd scope list silently promotes a token to unrestricted.
    const usable = scopes.map((s) => String(s || '').trim()).filter(Boolean);
    if (!usable.length) return false;

    return usable.some((scope) => McpTokenScopeMatcher.matches(scope, target));
  }

  private static matches(scope: string, tool: string): boolean {
    if (scope === tool) return true;
    if (!scope.endsWith('.*')) return false;
    // The dot stays in the prefix so `content.*` cannot match `contentious.update`.
    const prefix = scope.slice(0, -1);
    return tool.startsWith(prefix) && tool.length > prefix.length;
  }
}
