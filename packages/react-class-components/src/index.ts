// This entry's own React pieces, by relative path.
export { Reactor } from './reactor';
export { PureReactor } from './pure-reactor';
export { Provider } from './provider';
export { Bridge } from './bridge';
export { Context } from './context';
export { Transition } from './transition';
export { Registry } from './registry';
export { html } from './html';
export { Protocol } from './protocol';
export { implement } from './implement';
export { ref } from './ref.decorator';
export type { Ref } from './interfaces/ref.interface';
export { template } from './template.decorator';
export { ReactPrimitives } from './react-primitives';
export { ReactDomRoots } from './react-dom-roots';

// The React-free pieces come from this package's own `/lang` entry, by NAME — never a relative path, and
// never mixed in above: the CommonJS main bundle marks `@fromcode119/react-class-components/lang`
// external, so `require` resolves both entries to ONE `lang.cjs`. Bundled twice, `index.cjs` and
// `lang.cjs` each carried their own `Enum`, and a value from one was not `instanceof` the other — in the
// api and in every plugin process, which load this package via require. (The pieces above cannot be
// imported by name: `@fromcode119/react-class-components` IS this file.)
export {
  Enum,
  bound,
  watch,
  state,
  prop,
  Platform,
  ReactiveMetadata,
  ReservedMember,
  WatcherDescriptor,
} from '@fromcode119/react-class-components/lang';
