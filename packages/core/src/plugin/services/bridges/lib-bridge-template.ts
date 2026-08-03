/**
 * Browser module source served for every plain library module the client does not already handle —
 * in practice `@fromcode119/reactor` plus whatever a plugin declares in its manifest.
 *
 * `{{EXPORTS}}` and `{{SCOPE}}` are substituted by {@link RuntimeService.generateBridgeSource}, which
 * builds one `export const` per registered key.
 *
 * This is GENERATED OUTPUT, not application code. It is a compiled `static readonly` constant rather
 * than a hand-written `.js` file in the package: core's source tree holds no JavaScript, nothing is read
 * off disk at runtime, and the previous `|| ''` fallback — which silently served an EMPTY module when
 * the file was missing — is gone with it.
 */
export class LibBridgeTemplate {
  static readonly SOURCE = `{{EXPORTS}}
export default {{SCOPE}};
`;
}
