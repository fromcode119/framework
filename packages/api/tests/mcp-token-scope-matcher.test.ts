import { describe, expect, it } from 'vitest';
import { McpTokenScopeMatcher } from '@api/server/mcp-token-scope-matcher';

describe('McpTokenScopeMatcher.allows', () => {
  it('allows everything when the token declares no scopes', () => {
    expect(McpTokenScopeMatcher.allows(undefined, 'content.update')).toBe(true);
    expect(McpTokenScopeMatcher.allows(null, 'content.update')).toBe(true);
    expect(McpTokenScopeMatcher.allows([], 'content.update')).toBe(true);
  });

  it('matches an exact tool name', () => {
    expect(McpTokenScopeMatcher.allows(['content.update'], 'content.update')).toBe(true);
    expect(McpTokenScopeMatcher.allows(['content.update'], 'content.create')).toBe(false);
  });

  it('matches a trailing wildcard across one or more segments', () => {
    expect(McpTokenScopeMatcher.allows(['content.*'], 'content.update')).toBe(true);
    expect(McpTokenScopeMatcher.allows(['alpha.*'], 'alpha.page.slots.set')).toBe(true);
    expect(McpTokenScopeMatcher.allows(['content.*'], 'media.upload')).toBe(false);
  });

  it('does not let a wildcard leak across a namespace boundary', () => {
    expect(McpTokenScopeMatcher.allows(['content.*'], 'contentious.update')).toBe(false);
  });

  it('allows when any one scope matches', () => {
    expect(McpTokenScopeMatcher.allows(['media.read', 'content.*'], 'content.list')).toBe(true);
  });

  it('ignores blank entries rather than treating them as a match', () => {
    expect(McpTokenScopeMatcher.allows(['', '   '], 'content.list')).toBe(false);
  });

  it('refuses an empty tool name', () => {
    expect(McpTokenScopeMatcher.allows(['content.*'], '')).toBe(false);
  });
});
