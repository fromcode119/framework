// The React-free pieces come from this package's own `/lang` entry, by name, never a relative path: the
// CommonJS main bundle marks it external, so `require` resolves both entries to ONE `lang.cjs`. Bundled
// twice, `index.cjs` and `lang.cjs` each carried their own `Enum`, and a value from one was not
// `instanceof` the other — in the api and in every plugin process, which load this package via require.
export { Reactor } from './reactor';
export { PureReactor } from './pure-reactor';
export { Provider } from './provider';
export { Bridge } from './bridge';
export { Context } from './context';
export { Transition } from './transition';
export { Registry } from './registry';
export { html } from './html';
export { Enum } from '@fromcode119/react-class-components/lang';
export { Protocol } from './protocol';
export { implement } from './implement';
export { bound } from '@fromcode119/react-class-components/lang';
export { watch } from '@fromcode119/react-class-components/lang';
export { state } from '@fromcode119/react-class-components/lang';
export { prop } from '@fromcode119/react-class-components/lang';
export { ref } from './ref.decorator';
export type { Ref } from './interfaces/ref.interface';
export { template } from './template.decorator';
export { Platform } from '@fromcode119/react-class-components/lang';
export { ReactPrimitives } from './react-primitives';
export { ReactDomRoots } from './react-dom-roots';
export { ReactiveMetadata } from '@fromcode119/react-class-components/lang';
export { ReservedMember } from '@fromcode119/react-class-components/lang';
export { WatcherDescriptor } from '@fromcode119/react-class-components/lang';
