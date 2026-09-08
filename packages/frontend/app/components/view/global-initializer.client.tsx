import React from 'react';

import ReactDOM from 'react-dom';
import { ReactDomRoots, Reactor } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react/icons/view/framework-icons.client';
import { StorefrontRuntimeGlobals } from '@/runtime/storefront-runtime-globals';
import { ContextHooks } from '@fromcode119/react';
import { RuntimeRegistryAccess, EnvUtils } from '@fromcode119/core/client';

export class GlobalInitializer extends Reactor {
    render() {
        if (EnvUtils.isBrowser()) {
            // The `process` shim and the icon provider — shared with the islands runtime's boot, which
            // performs them before any tree exists (see StorefrontRuntimeGlobals).
            StorefrontRuntimeGlobals.install();

            // Pre-boot stub on the ONE runtime registry (no bare window.React / window.Fromcode).
            // The full bridge (installRuntimeBridge) later replaces the @fromcode119/react entry.
            const registry = RuntimeRegistryAccess.ensure();
            registry[RuntimeRegistryAccess.KEYS.REACT] = React;
            // React 19's `react-dom` no longer carries the root factories (they live in `react-dom/client`),
            // but the import map's `react-dom` module destructures `createRoot` / `hydrateRoot` from THIS
            // entry — so a bundle that mounts its own root gets them from the one bundled react-dom.
            registry[RuntimeRegistryAccess.KEYS.REACT_DOM] = {
                ...ReactDOM,
                createRoot: ReactDomRoots.createRoot,
                hydrateRoot: ReactDomRoots.hydrateRoot,
            };
            registry[RuntimeRegistryAccess.KEYS.JSX_RUNTIME] = RuntimeRegistryAccess.jsxRuntimeFor(React);
            registry[RuntimeRegistryAccess.KEYS.LUCIDE] = FrameworkIcons;
            registry[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] ||= {
                useTranslation: ContextHooks.useTranslation,
                getIcon: FrameworkIcons.getIcon.bind(FrameworkIcons),
            };
        }

        return null;
    }
}
