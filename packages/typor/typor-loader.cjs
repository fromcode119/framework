/**
 * Webpack/Turbopack loader for typor's extended syntax.
 *
 * Rewrites `class X extends A, B {}` into `Typor.mixin(A, B)` at build time, so source can use plain
 * multiple inheritance. Line-preserving, so stack traces and sourcemaps stay accurate.
 */
const { TyporSyntaxPlugin } = require('./dist/build.cjs');

module.exports = function typorSyntaxLoader(source) {
  return TyporSyntaxPlugin.transform(source);
};
