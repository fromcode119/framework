import { beforeEach, describe, expect, it } from 'vitest';
import type { IPluginDefaultPageContractRegistration } from '@core/default-page-contract/interfaces/plugin-default-page-contract-registration.interface';
import { PluginDefaultPageContractRegistryService } from '@core/services/default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';

describe('PluginDefaultPageContractRegistryService', () => {
  let service: PluginDefaultPageContractRegistryService;

  beforeEach(() => {
    service = new PluginDefaultPageContractRegistryService();
  });

  it('registers plugin contracts with canonical keys', () => {
    const registration: IPluginDefaultPageContractRegistration = {
      namespace: 'org.synthetic',
      pluginSlug: 'catalog-alpha',
      contracts: [
        {
          key: 'store-index',
          kind: PluginDefaultPageContractKind.INDEX,
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'catalog-alpha.store-index',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.SEARCH],
          adoptionHints: ['/shop', '/shop'],
          required: true,
        },
      ],
    };

    const result = service.register(registration);

    expect(result).toEqual([
      {
        key: 'store-index',
        kind: PluginDefaultPageContractKind.INDEX,
        defaultSlug: '/shop',
        capability: 'catalog',
        recipe: 'catalog-alpha.store-index',
        materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
        dependencies: [PluginDefaultPageContractDependency.SEARCH],
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
          kind: PluginDefaultPageContractKind.FORM_PAGE,
          defaultSlug: '/contact',
          capability: 'contact-form',
          recipe: 'contact-beta.contact-page',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.AUDIT],
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
          kind: PluginDefaultPageContractKind.FORM_PAGE,
          defaultSlug: '/contact-us',
          capability: 'contact-form',
          recipe: 'contact-beta.contact-page',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.AUDIT],
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
            kind: PluginDefaultPageContractKind.FORM_PAGE,
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'contact-beta.contact-page',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.AUDIT],
            adoptionHints: ['/contact'],
            required: true,
          },
          {
            key: 'contact-page',
            kind: PluginDefaultPageContractKind.FORM_PAGE,
            defaultSlug: '/contact-alt',
            capability: 'contact-form',
            recipe: 'contact-beta.contact-page-alt',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.AUDIT],
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
          kind: PluginDefaultPageContractKind.INDEX,
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'catalog-alpha.store-index',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.SEARCH],
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
          kind: PluginDefaultPageContractKind.INDEX,
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog-beta.store-index',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.SEARCH],
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
          kind: PluginDefaultPageContractKind.POLICY,
          defaultSlug: '/cookies-policy',
          capability: 'compliance',
          recipe: 'policy-gamma.cookies-policy-page',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.AUDIT, PluginDefaultPageContractDependency.NAVIGATION],
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
        dependencies: [PluginDefaultPageContractDependency.AUDIT, PluginDefaultPageContractDependency.NAVIGATION],
        adoptionHints: ['/cookies-policy'],
        aliases: ['/cookies'],
      }),
    ]);
  });
});