import { beforeEach, describe, expect, it } from 'vitest';
import type { PluginDefaultPageContractRegistration } from '../../../types';
import { PluginDefaultPageContractRegistryService } from '../plugin-default-page-contract-registry-service';

describe('PluginDefaultPageContractRegistryService', () => {
  let service: PluginDefaultPageContractRegistryService;

  beforeEach(() => {
    service = new PluginDefaultPageContractRegistryService();
  });

  it('registers plugin contracts with canonical keys', () => {
    const registration: PluginDefaultPageContractRegistration = {
      namespace: 'org.synthetic',
      pluginSlug: 'catalog-alpha',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'catalog-alpha.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/shop', '/shop'],
          required: true,
        },
      ],
    };

    const result = service.register(registration);

    expect(result).toEqual([
      {
        key: 'store-index',
        kind: 'index',
        defaultSlug: '/shop',
        capability: 'catalog',
        recipe: 'catalog-alpha.store-index',
        materializationMode: 'singleton-document',
        dependencies: ['search'],
        adoptionHints: ['/shop'],
        aliases: undefined,
        required: true,
        recordCollection: undefined,
        namespace: 'org.synthetic',
        pluginSlug: 'catalog-alpha',
        canonicalKey: 'org.synthetic:catalog-alpha:store-index',
      },
    ]);
    expect(service.listByPlugin('org.synthetic', 'catalog-alpha')).toHaveLength(1);
  });

  it('replaces previous registrations for the same plugin on re-register', () => {
    service.register({
      namespace: 'org.synthetic',
      pluginSlug: 'contact-beta',
      contracts: [
        {
          key: 'contact-page',
          kind: 'form-page',
          defaultSlug: '/contact',
          capability: 'contact-form',
          recipe: 'contact-beta.contact-page',
          materializationMode: 'singleton-document',
          dependencies: ['audit'],
          adoptionHints: ['/contact'],
          required: true,
        },
      ],
    });

    service.register({
      namespace: 'org.synthetic',
      pluginSlug: 'contact-beta',
      contracts: [
        {
          key: 'contact-page',
          kind: 'form-page',
          defaultSlug: '/contact-us',
          capability: 'contact-form',
          recipe: 'contact-beta.contact-page',
          materializationMode: 'singleton-document',
          dependencies: ['audit'],
          adoptionHints: ['/contact-us'],
          required: true,
        },
      ],
    });

    expect(service.listByPlugin('org.synthetic', 'contact-beta')).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.synthetic:contact-beta:contact-page',
        defaultSlug: '/contact-us',
        adoptionHints: ['/contact-us'],
      }),
    ]);
  });

  it('rejects duplicate canonical keys within the same registration batch', () => {
    expect(() => {
      service.register({
        namespace: 'org.synthetic',
        pluginSlug: 'contact-beta',
        contracts: [
          {
            key: 'contact-page',
            kind: 'form-page',
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'contact-beta.contact-page',
            materializationMode: 'singleton-document',
            dependencies: ['audit'],
            adoptionHints: ['/contact'],
            required: true,
          },
          {
            key: 'contact-page',
            kind: 'form-page',
            defaultSlug: '/contact-alt',
            capability: 'contact-form',
            recipe: 'contact-beta.contact-page-alt',
            materializationMode: 'singleton-document',
            dependencies: ['audit'],
            adoptionHints: ['/contact-alt'],
            required: true,
          },
        ],
      });
    }).toThrow('duplicate default page contract registration: org.synthetic:contact-beta:contact-page');
  });

  it('allows the same key across different plugins and namespaces', () => {
    service.register({
      namespace: 'org.synthetic',
      pluginSlug: 'catalog-alpha',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'catalog-alpha.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/shop'],
          required: true,
        },
      ],
    });

    service.register({
      namespace: 'org.sample',
      pluginSlug: 'catalog-beta',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog-beta.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/catalog'],
          required: true,
        },
      ],
    });

    expect(service.list()).toHaveLength(2);
    expect(service.list().map((entry) => entry.canonicalKey)).toEqual([
      'org.synthetic:catalog-alpha:store-index',
      'org.sample:catalog-beta:store-index',
    ]);
  });

  it('returns defensive clones for registered entries', () => {
    const [entry] = service.register({
      namespace: 'org.synthetic',
      pluginSlug: 'policy-gamma',
      contracts: [
        {
          key: 'cookies-policy-page',
          kind: 'policy',
          defaultSlug: '/cookies-policy',
          capability: 'compliance',
          recipe: 'policy-gamma.cookies-policy-page',
          materializationMode: 'singleton-document',
          dependencies: ['audit', 'navigation'],
          adoptionHints: ['/cookies-policy'],
          aliases: ['/cookies'],
          required: true,
        },
      ],
    });

    entry.dependencies.push('preview');
    entry.adoptionHints.push('/mutated');
    entry.aliases?.push('/mutated-alias');

    expect(service.list()).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.synthetic:policy-gamma:cookies-policy-page',
        dependencies: ['audit', 'navigation'],
        adoptionHints: ['/cookies-policy'],
        aliases: ['/cookies'],
      }),
    ]);
  });
});