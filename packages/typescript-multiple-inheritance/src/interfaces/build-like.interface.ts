/**
 * The subset of esbuild's plugin API this package uses, declared structurally so esbuild is never a hard
 * dependency of typescript-multiple-inheritance.
 *
 * A behavioural contract — it declares a method — so it is an `interface`, not a class: typescript-multiple-inheritance only ever
 * RECEIVES one of these from esbuild and calls it, and never constructs one.
 */
export interface IBuildLike {
  onLoad(
    options: { filter: RegExp },
    callback: (args: { path: string }) => Promise<{ contents: string; loader: string } | undefined>,
  ): void;
}
