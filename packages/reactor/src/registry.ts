import type { ComponentType } from 'react';

/**
 * A key → component registry. Register what a surface uses ONCE (bulk), then resolve by key — so a
 * template/view can reference `Navbar` or `Box` without importing it, and the same file works whether
 * a tag is a Chakra component, a native element wrapper, or a custom class.
 *
 * Register in bulk, never one-by-one:
 *   import * as Chakra from '@chakra-ui/react';
 *   Registry.addAll(Chakra);                       // Box, Flex, Text, … all at once
 *   Registry.addAll({ Navbar, Footer, CartDrawer }); // your components, shorthand keys
 *
 * Collisions THROW — you resolve them by choosing a distinct key, never by aliasing an import:
 *   Registry.addAll({ Link });                     // e.g. Chakra Link
 *   Registry.add('AppLink', MyLink);               // distinct key — no `import { Link as Link2 }`
 */
export class Registry {
  private static readonly components = new Map<string, ComponentType<any>>();

  /** Register one component under `key`. Throws if the key is already taken. */
  static add(key: string, component: ComponentType<any>): void {
    if (Registry.components.has(key)) {
      throw new Error(`Registry: "${key}" is already registered — choose a distinct key instead of aliasing.`);
    }
    Registry.components.set(key, component);
  }

  /** Register many at once from a `{ Name: Component }` record (e.g. `import * as Lib`). */
  static addAll(components: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(components)) {
      if (Registry.isComponent(value)) Registry.add(key, value as ComponentType<any>);
    }
  }

  /** Resolve a registered component by key. Throws if it is not registered. */
  static get(key: string): ComponentType<any> {
    const component = Registry.components.get(key);
    if (!component) throw new Error(`Registry: "${key}" is not registered.`);
    return component;
  }

  static has(key: string): boolean {
    return Registry.components.has(key);
  }

  static keys(): string[] {
    return [...Registry.components.keys()];
  }

  /**
   * Registerable = a function (class/function component) or a non-null object (forwardRef/memo result,
   * or an icon/namespace object like `Icons` used as `<Icons.Mail>`). Skips primitive exports (numbers,
   * strings) so `addAll(SomeLibrary)` ignores its constants.
   */
  private static isComponent(value: unknown): boolean {
    return typeof value === 'function' || (typeof value === 'object' && value !== null);
  }
}
