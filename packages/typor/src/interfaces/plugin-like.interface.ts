import type { IBuildLike } from './build-like.interface';

/**
 * The shape esbuild expects a plugin object to have. A behavioural contract (it declares `setup`), so it
 * is an `interface`; typor returns a plain object satisfying it rather than depending on esbuild's types.
 */
export interface IPluginLike {
  name: string;
  setup(build: IBuildLike): void;
}
