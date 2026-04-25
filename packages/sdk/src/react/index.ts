// Clean workspace builds can typecheck this wrapper before the forwarded package
// has stable declarations available. The emitted JS still re-exports the package.
// @ts-ignore
export * from '@fromcode119/react';
