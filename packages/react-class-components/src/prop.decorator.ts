import { ReservedMember } from './reserved-member';

/**
 * `@prop` — exposes a React prop as a read-only instance property, so components read `this.url`
 * instead of `this.props.url` and need no `<Props>` generic on the class at all.
 *
 *   export class VideoField extends Reactor {     // no <Props, State> — clean
 *     @prop declare url: string;
 *     @state playing = false;
 *     render() { return <video src={this.url} controls={this.playing} />; }
 *   }
 *
 * Use `declare` (or `!`) so no field initialiser is emitted to clobber the accessor. Props are
 * read-only by contract, so this installs a getter only.
 */
export function prop(target: object, propertyKey: string | symbol): void {
  if (typeof propertyKey !== 'string') {
    throw new TypeError('@prop can only decorate string-named fields.');
  }
  ReservedMember.assertUsable('@prop', target, propertyKey);
  Object.defineProperty(target, propertyKey, {
    configurable: true,
    enumerable: true,
    get(this: { props?: Record<string, unknown> }): unknown {
      return this.props?.[propertyKey];
    },
  });
}
