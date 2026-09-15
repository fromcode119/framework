import { describe, expect, it } from 'vitest';
import { PersonalDataErasurePolicy } from '@core/plugin/services/people/personal-data-erasure-policy';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The policy is the thing that makes the two erasure doors agree, so these tests are about WHICH
 * layer wins and whether the answer says so out loud. A choice whose origin is not stated is the
 * failure mode this whole design exists to prevent: an operator reading a fallback as a decision.
 */
const TARGET = {
  pluginSlug: 'finance',
  key: 'invoices',
  label: 'Invoices',
  strategies: ['retain', 'anonymise'],
  defaultStrategy: 'anonymise',
};

/**
 * A database with the two rows the policy reads. `site` is the tenanted row; `platform` is the
 * `tenant_id IS NULL` row that only a platform-marked connection can see, so it is served from the
 * raw query the policy makes inside `withPlatformAdmin` — the same shape the real Postgres path uses.
 */
const makeDb = (rows: { site?: unknown; platform?: unknown }) => ({
  dialect: 'postgres',
  findOne: async (_table: string, where: any) =>
    where.key === SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES && rows.site !== undefined
      ? { value: typeof rows.site === 'string' ? rows.site : JSON.stringify(rows.site) }
      : null,
  withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
  queryRaw: async () =>
    rows.platform === undefined
      ? []
      : [{ value: typeof rows.platform === 'string' ? rows.platform : JSON.stringify(rows.platform) }],
});

describe('PersonalDataErasurePolicy', () => {
  it('falls through to the dataset\'s own default, and names the plugin that declared it', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({}) as any);

    const choice = policy.resolve(TARGET);

    expect(choice).toMatchObject({
      id: 'finance:invoices', strategy: 'anonymise', source: 'declared',
      provenance: 'Default declared by finance', problem: '',
    });
  });

  it('prefers the platform default over the declared one', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({
      platform: { 'finance:invoices': { strategy: 'retain', reason: 'Accounting law, 10 years.' } },
    }) as any);

    const choice = policy.resolve(TARGET);

    expect(choice.strategy).toBe('retain');
    expect(choice.source).toBe('platform');
    expect(choice.reason).toBe('Accounting law, 10 years.');
  });

  it('prefers the site over the platform, because the site controls its own data', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({
      platform: { 'finance:invoices': { strategy: 'retain', reason: 'Accounting law, 10 years.' } },
      site: { 'finance:invoices': { strategy: 'anonymise' } },
    }) as any);

    const choice = policy.resolve(TARGET);

    expect(choice.strategy).toBe('anonymise');
    expect(choice.source).toBe('site');
    expect(choice.provenance).toBe('Site policy (Settings → Personal data)');
  });

  it('prefers a per-run override over everything, and attributes it to the person who chose', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({
      site: { 'finance:invoices': { strategy: 'anonymise' } },
    }) as any, {
      overrides: { 'finance:invoices': { strategy: 'retain', reason: 'Litigation hold.' } },
      actor: 'dpo@example.test',
    });

    const choice = policy.resolve(TARGET);

    expect(choice.strategy).toBe('retain');
    expect(choice.source).toBe('request');
    expect(choice.provenance).toBe('Chosen for this request by dpo@example.test');
  });

  it('skips a layer whose strategy the dataset no longer offers, and says so', async () => {
    // Silently applying `delete` to a dataset an operator marked otherwise would be the worst
    // available correction, so the next layer applies and the operator is told to choose again.
    const policy = await PersonalDataErasurePolicy.load(makeDb({
      site: { 'finance:invoices': { strategy: 'delete' } },
      platform: { 'finance:invoices': { strategy: 'retain', reason: 'Accounting law, 10 years.' } },
    }) as any);

    const choice = policy.resolve(TARGET);

    expect(choice.strategy).toBe('retain');
    expect(choice.source).toBe('platform');
    expect(choice.problem).toContain('no longer offered by finance');
  });

  it('refuses a retention with no stated legal basis, and falls to the next layer', async () => {
    // A retention nobody justified is indistinguishable from doing nothing, and the basis is the one
    // thing the subject is entitled to be told.
    const policy = await PersonalDataErasurePolicy.load(makeDb({
      site: { 'finance:invoices': { strategy: 'retain', reason: '   ' } },
    }) as any);

    const choice = policy.resolve(TARGET);

    expect(choice.strategy).toBe('anonymise');
    expect(choice.source).toBe('declared');
    expect(choice.problem).toContain('no stated legal basis');
  });

  it('treats an unreadable stored blob as nothing stored, rather than failing the erasure', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({ site: 'not json at all' }) as any);

    expect(policy.resolve(TARGET).source).toBe('declared');
  });

  it('leaves other datasets alone when one of them is overridden', async () => {
    const policy = await PersonalDataErasurePolicy.load(makeDb({}) as any, {
      overrides: { 'finance:invoices': { strategy: 'retain', reason: 'Litigation hold.' } },
    });

    const other = policy.resolve({ ...TARGET, key: 'wallets', label: 'Wallets' });

    expect(other.source).toBe('declared');
    expect(other.id).toBe('finance:wallets');
  });
});
