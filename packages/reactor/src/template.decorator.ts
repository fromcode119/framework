import type { ReactNode } from 'react';

type ViewFn = (this: unknown) => ReactNode;

/**
 * `@template('./x.view')` — declare that markup lives in a separate file, BY PATH, with NO `import`.
 * Works two ways:
 *
 *  • On a METHOD — the method returns that template (this-bound). Use it to split a component into several
 *    named UI chunks, each in its own file, composed by a plain `render()`. Type the method `: ReactNode`
 *    with a `return null` placeholder (the build fills the body) — then it composes with NO cast:
 *      @template('./2fa-setup.view')  private renderSetup(): ReactNode { return null; }
 *      render() { return <section>{this.enabled ? this.renderEnabled() : this.renderSetup()}</section>; }
 *
 *  • On a CLASS — sets the component's `view` (the whole render), for a component that is only markup:
 *      @template('./card.view') export class Card extends Reactor { @prop declare title: string; }
 *
 * `@fromcode119/nextor`'s TemplateDecoratorPlugin rewrites the string path into an import, so this decorator
 * receives the compiled template function. (Un-built, the string arg is inert.) Name view files anything.
 */
export function template(
  view: string | ViewFn,
): (target: unknown, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => PropertyDescriptor | void {
  return (target, _propertyKey, descriptor) => {
    if (typeof view !== 'function') return descriptor;          // path not yet rewritten by the build
    if (descriptor) {
      descriptor.value = function (this: unknown): ReactNode {   // method: return the template, this-bound
        return view.call(this);
      };
      return descriptor;
    }
    (target as { prototype: { view?: ViewFn } }).prototype.view = view;   // class: set the whole-component view
  };
}
