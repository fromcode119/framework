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
      namespace: 'org.fromcode',
      pluginSlug: 'ecommerce',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'ecommerce.store-index',
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
        recipe: 'ecommerce.store-index',
        materializationMode: 'singleton-document',
        dependencies: ['search'],
        adoptionHints: ['/shop'],
        required: true,
        namespace: 'org.fromcode',
        pluginSlug: 'ecommerce',
        canonicalKey: 'org.fromcode:ecommerce:store-index',
      },
    ]);
    expect(service.listByPlugin('org.fromcode', 'ecommerce')).toHaveLength(1);
  });

  it('rejects duplicate canonical keys', () => {
    service.register({
      namespace: 'org.fromcode',
      pluginSlug: 'forms',
      contracts: [
        {
          key: 'contact-page',
          kind: 'form-page',
          defaultSlug: '/contact',
          capability: 'contact-form',
          recipe: 'forms.contact-page',
          materializationMode: 'singleton-document',
          dependencies: ['audit'],
          adoptionHints: ['/contact'],
          required: true,
        },
      ],
    });

    expect(() => {
      service.register({
        namespace: 'org.fromcode',
        pluginSlug: 'forms',
        contracts: [
          {
            key: 'contact-page',
            kind: 'form-page',
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'forms.contact-page',
            materializationMode: 'singleton-document',
            dependencies: ['audit'],
            adoptionHints: ['/contact'],
            required: true,
          },
        ],
      });
    }).toThrow('duplicate default page contract registration: org.fromcode:forms:contact-page');
  });

  it('allows the same key across different plugins and namespaces', () => {
    service.register({
      namespace: 'org.fromcode',
      pluginSlug: 'ecommerce',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'ecommerce.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/shop'],
          required: true,
        },
      ],
    });

    service.register({
      namespace: 'org.partner',
      pluginSlug: 'catalog',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/catalog'],
          required: true,
        },
      ],
    });

    expect(service.list()).toHaveLength(2);
    expect(service.list().map((entry) => entry.canonicalKey)).toEqual([
      'org.fromcode:ecommerce:store-index',
      'org.partner:catalog:store-index',
    ]);
  });

  it('returns defensive clones for registered entries', () => {
    const [entry] = service.register({
      namespace: 'org.fromcode',
      pluginSlug: 'privacy',
      contracts: [
        {
          key: 'cookies-policy-page',
          kind: 'policy',
          defaultSlug: '/cookies-policy',
          capability: 'compliance',
          recipe: 'privacy.cookies-policy-page',
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
        canonicalKey: 'org.fromcode:privacy:cookies-policy-page',
        dependencies: ['audit', 'navigation'],
        adoptionHints: ['/cookies-policy'],
        aliases: ['/cookies'],
      }),
    ]);
  });
});