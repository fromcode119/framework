/**
 * reactor's React-FREE surface: the language-level pieces that happen to ship with a React library but
 * import nothing from React.
 *
 * The main barrel exports `Reactor` — a React class component — and through it react-dom. React's
 * server-component compiler REFUSES a class component (or `react-dom/client`) anywhere in a server
 * module graph, so a single `import { Enum } from '@fromcode119/react-class-components'` in a middleware, a route
 * handler or a Server Component 500s the whole request. Those consumers import from here instead:
 * same classes, no React in the graph.
 */
export { Enum } from './enum';
export { Platform } from './platform';
export { ReactiveMetadata } from './reactive-metadata';
export { WatcherDescriptor } from './watcher-descriptor';
export { ReservedMember } from './reserved-member';
export { bound } from './bound.decorator';
export { prop } from './prop.decorator';
export { state } from './state.decorator';
export { watch } from './watch.decorator';
