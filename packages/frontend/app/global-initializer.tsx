"use client";

import React from 'react';
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
    return null;
}
