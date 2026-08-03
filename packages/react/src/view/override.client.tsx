import React from 'react';
import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { OverridesContext } from '@react/context/overrides-context';

/**
 * Renders a plugin- or theme-registered replacement for a named surface, falling back to the children
 * (or an explicit `fallback`) when nothing is registered.
 */
export class Override extends Reactor {
  @prop declare name: string;
  @prop declare children?: ReactNode;
  @prop declare fallback?: ReactNode;

  /**
   * Props handed to the override component — opaque, the registering plugin defines the shape.
   *
   * NOT a `@prop`: `props` is one of the members React owns on a component, so decorating it throws at
   * decoration time. Themes already pass `props={{ … }}`, so the public name has to stay `props`; it is
   * read through React's own `this.props` instead.
   */
  private get overrideProps(): Record<string, unknown> {
    return (this.props as { props?: Record<string, unknown> }).props ?? {};
  }

  /**
   * An override comes from a plugin bundle at runtime, so it is UNTRUSTED input rather than a framework
   * contract: it may be a component, an intrinsic tag name, or (after a bad build) neither. That is why
   * this checks the value rather than trusting it — see the no-defensive-typeof rule, which governs
   * framework contracts, not third-party payloads.
   */
  private static isValidComponent(component: unknown): boolean {
    return typeof component === 'function'
      || typeof component === 'string'
      || Boolean((component as { $$typeof?: unknown })?.$$typeof);
  }

  private get normalizedContent(): ReactNode[] {
    return React.Children.toArray(this.children ?? this.fallback);
  }

  render(): ReactNode {
    return (
      <OverridesContext.Context.Consumer>
        {(overrides) => {
          const item = overrides[this.name];
          const content = this.normalizedContent;

          if (!item?.component) return <>{content}</>;

          if (!Override.isValidComponent(item.component)) {
            console.warn(`[Override] Component for override "${this.name}" is of invalid type: ${typeof item.component}. Skipping.`);
            return <>{content}</>;
          }

          try {
            return React.createElement(item.component, {
              ...this.overrideProps,
              key: `${item.pluginSlug}-${this.name}`,
            }, content);
          } catch (error) {
            console.error(`[Override] Runtime error in override component "${this.name}":`, error);
            return <>{content}</>;
          }
        }}
      </OverridesContext.Context.Consumer>
    );
  }
}
