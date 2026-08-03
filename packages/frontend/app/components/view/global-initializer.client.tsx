import React from 'react';

import ReactDOM from 'react-dom';
import { Reactor } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react/icons/view/framework-icons.client';
import { SystemIconProvider } from '@/lib/system-icon-provider';
import { ContextHooks } from '@fromcode119/react';
import { RuntimeRegistryAccess, EnvUtils } from '@fromcode119/core/client';

export class GlobalInitializer extends Reactor {
    render() {
        if (EnvUtils.isBrowser()) {
            // Polyfill process for browser compatibility in themes/plugins
            (window as any).process = {
                env: { NODE_ENV: 'production' }
            };

            // Pre-boot stub on the ONE runtime registry (no bare window.React / window.Fromcode).
            // The full bridge (installRuntimeBridge) later replaces the @fromcode119/react entry.
            // Explicit, ordered registration — this used to happen as a side effect of importing
            // `lib/icons`, so it ran at whatever point the module graph happened to reach that file.
            SystemIconProvider.register();

            const registry = RuntimeRegistryAccess.ensure();
            registry[RuntimeRegistryAccess.KEYS.REACT] = React;
            registry[RuntimeRegistryAccess.KEYS.REACT_DOM] = ReactDOM;
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
