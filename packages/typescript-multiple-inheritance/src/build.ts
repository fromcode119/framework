// BUILD-TIME entry — Node only. Never import this from application/runtime code.
//
// typescript-multiple-inheritance is STANDALONE: everything here works on any TypeScript project. The convention guards and
// codemods that encode THIS project (its areas, ratchet baselines, `@fromcode119/*` path map and
// component base classes) live in `@fromcode119/arch-guard`, which is the framework's policy package.
export { TyporSyntaxPlugin } from './tsmi-syntax-plugin';
export { AliasEmitRewrite } from './alias-emit-rewrite';
export { TyporEsbuildPlugin } from './tsmi-esbuild-plugin';
export { ModuleConstantFold } from './module-constant-fold';
export { ModuleDestructureFold } from './module-destructure-fold';
export { ReactDefaultImportPrune } from './react-default-import-prune';
export { InterfaceSplitMigration } from './interface-split-migration';
export { TypeAliasToInterface } from './type-alias-to-interface';
