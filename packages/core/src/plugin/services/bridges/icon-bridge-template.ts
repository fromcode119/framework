/**
 * Browser module source served for an icon module.
 *
 * `{{EXPORTS}}` is substituted by {@link RuntimeService.generateBridgeSource} with one `export const`
 * per known icon key; the default export proxies any other name. GENERATED OUTPUT, not application
 * code — a compiled constant rather than a `.js` file on disk, so nothing is read at runtime.
 *
 * Currently UNUSED in practice: the only icon module anything declares is `lucide-react`, which is in
 * `RuntimeConstants.CLIENT_HANDLED_MODULES` and therefore skipped by every caller. It is kept because
 * the branch is generic — a plugin declaring its own (non-client-handled) icon pack would use it —
 * unlike the JSX template beside it, which was gated on three permanently client-handled names and so
 * could never run at all.
 */
export class IconBridgeTemplate {
  static readonly SOURCE = `// Dynamic Icon Bridge
import { FrameworkIcons } from '@fromcode119/react';

// Explicitly export known keys for named imports
{{EXPORTS}}

// Default export is a proxy for any other icon name
export default new Proxy({}, {
    get: (_, name) => FrameworkIcons.createProxyIcon(name)
});
`;
}
