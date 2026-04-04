"use client";

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FrameworkIcons } from '@/lib/icons';
import { ContextHooks } from '@fromcode119/react';

export default function GlobalInitializer() {
    if (typeof window !== 'undefined') {
        // Polyfill process for browser compatibility in themes/plugins
        (window as any).process = {
            env: { NODE_ENV: 'production' }
        };

        (window as any).React = React;
        (window as any).ReactDOM = ReactDOM;
        (window as any).FrameworkIcons = FrameworkIcons;
        (window as any).getIcon = FrameworkIcons.getIcon.bind(FrameworkIcons);

        // Bridge for plugins/themes
        (window as any).Fromcode = {
            useTranslation: ContextHooks.useTranslation,
            getIcon: FrameworkIcons.getIcon.bind(FrameworkIcons),
        };
    }

    useEffect(() => {
        const themeEntry = document
            .querySelector('meta[name="fromcode:theme-entry"]')
            ?.getAttribute('content');

        if (!themeEntry || document.querySelector(`script[data-theme-entry="${themeEntry}"]`)) {
            return;
        }

        (window as any).React = React;
        (window as any).ReactDOM = ReactDOM;

        const script = document.createElement('script');
        script.src = themeEntry;
        script.setAttribute('data-theme-entry', themeEntry);
        script.onerror = (error) => console.warn('[frontend] Failed to load theme bundle from meta bootstrap:', error);
        document.head.appendChild(script);
    }, []);

    return null;
}
