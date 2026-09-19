/**
 * Webpack/Turbopack loader for typescript-multiple-inheritance's extended syntax.
 *
 * Rewrites `class X extends A, B {}` into `Typor.mixin(A, B)` at build time, so source can use plain
 * multiple inheritance. Line-preserving, so stack traces and sourcemaps stay accurate.
 */

/**
 * Stays CommonJS, and must.
 *
 * A webpack/Turbopack loader is required by the bundler through Node's CJS resolver BEFORE any
 * TypeScript toolchain exists — this file is part of what makes compiling TypeScript possible, so it
 * cannot itself require compilation. The `.cjs` extension is what guarantees that, whatever module
 * type the surrounding package declares.
 */
const { TyporSyntaxPlugin } = require('./dist/build.cjs');

module.exports = function typorSyntaxLoader(source) {
  return TyporSyntaxPlugin.transform(source);
};
