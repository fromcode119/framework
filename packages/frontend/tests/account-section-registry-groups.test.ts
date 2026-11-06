import { describe, expect, it } from 'vitest';
import { AccountSectionRegistry } from '@fromcode119/react/account/account-section-registry';

const panel = (accountSection: Record<string, unknown>, pluginSlug = 'p') => ({ component: class { static accountSection = accountSection; }, pluginSlug }) as never;

describe('AccountSectionRegistry groups and merges', () => {
  it('folds a mergeInto panel into its target and keeps its key reachable', () => {
    const sections = AccountSectionRegistry.build([
      panel({ key: 'security', priority: 60, group: 'profile' }),
      panel({ key: 'sessions', priority: 65, mergeInto: 'security' }),
    ]);
    expect(sections.map((s) => s.key)).toEqual(['security']);
    expect(sections[0].items).toHaveLength(2);
    expect(AccountSectionRegistry.resolve(sections, 'sessions')?.key).toBe('security');
  });

  it('keeps a merged panel as its own section when the target is absent', () => {
    const sections = AccountSectionRegistry.build([panel({ key: 'sessions', mergeInto: 'security' })]);
    expect(sections.map((s) => s.key)).toEqual(['sessions']);
  });

  it('lists ungrouped sections first, then groups by their earliest section', () => {
    const sections = AccountSectionRegistry.build([
      panel({ key: 'overview', priority: -10 }),
      panel({ key: 'profile', priority: 0, group: 'profile' }),
      panel({ key: 'orders', priority: 10, group: 'shopping' }),
      panel({ key: 'security', priority: 60, group: 'profile' }),
    ]);
    const groups = AccountSectionRegistry.groups(sections);
    expect(groups.map((g) => g.key)).toEqual(['', 'profile', 'shopping']);
    expect(groups[1].sections.map((s) => s.key)).toEqual(['profile', 'security']);
    expect(groups[2].labelKey).toBe('account.group.shopping');
  });
});
