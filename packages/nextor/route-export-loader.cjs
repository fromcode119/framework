/**
 * Webpack/Turbopack loader entry for nextor's build-time source contracts.
 *
 * Next resolves routes by EXPORT NAME and detects client modules by a literal `'use client'` string —
 * neither of which a class can express. Both are generated here at BUILD time so source files declare
 * nothing but `export class`. See RouteExportPlugin and ClientDirectivePlugin.
 *
 * Requires the CJS bundle: bundlers load their loaders in a CommonJS context.
 */
const { RouteExportPlugin, ClientDirectivePlugin } = require('./dist/index.cjs');

module.exports = function nextorSourceContractLoader(source) {
  const path = this.resourcePath || '';
  return ClientDirectivePlugin.injectInto(RouteExportPlugin.injectInto(source, path), path);
};
