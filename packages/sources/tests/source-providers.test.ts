import { describe, expect, it } from 'vitest';
import { GitSourceProvider } from '@sources/providers/git/git-source-provider';
import { SourceProviders } from '@sources/providers/source-providers';

/**
 * The list is the contract: the admin's provider field, the value stored on a row, and the
 * implementation a build uses all derive from it. Adding a provider must mean adding a folder and a
 * line here — not a new branch in the build service and a new option in a dropdown.
 */
describe('SourceProviders', () => {
  const WORKSPACE = '/tmp/sources-test';

  it('offers every provider its definition, with the labels the form needs', () => {
    const definitions = SourceProviders.definitions();

    expect(definitions.length).toBeGreaterThan(0);
    for (const definition of definitions) {
      expect(definition.key).toBeTruthy();
      expect(definition.label).toBeTruthy();
      expect(definition.locationLabel).toBeTruthy();
      expect(definition.refLabel).toBeTruthy();
    }
  });

  it('resolves git, which is the provider every existing source uses', () => {
    expect(SourceProviders.find('git', WORKSPACE)).toBeInstanceOf(GitSourceProvider);
    expect(SourceProviders.defaultKey()).toBe('git');
  });

  /**
   * Not a fallback to git. A row naming a provider this build does not have is a row whose source
   * nobody can fetch, and fetching it with "whatever we do have" would pull something the operator
   * never pointed at — from a URL they entered for a different system.
   */
  it('refuses an unknown provider rather than substituting one', () => {
    expect(SourceProviders.find('svn', WORKSPACE)).toBeNull();
  });

  it('treats an absent provider as git, because every row that predates the field is git', () => {
    expect(SourceProviders.normalize(undefined)).toBe('git');
    expect(SourceProviders.normalize('')).toBe('git');
    expect(SourceProviders.normalize('  GIT  ')).toBe('git');
  });
});
