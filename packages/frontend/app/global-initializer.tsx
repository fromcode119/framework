"use client";

import React from 'react';
import ReactDOM from 'react-dom';
import { FrameworkIcons } from '../lib/icons';
import { getIcon, useTranslation } from '@fromcode119/react';

export default function GlobalInitializer() {
    if (typeof window !== 'undefined') {
        // Polyfill process for browser compatibility in themes/plugins
        (window as any).process = {
            env: { NODE_ENV: 'production' }
        };

        (window as any).React = React;
        (window as any).ReactDOM = ReactDOM;
        (window as any).FrameworkIcons = FrameworkIcons;
        (window as any).getIcon = getIcon;

        // Bridge for plugins/themes
        (window as any).Fromcode = {
            useTranslation,
            getIcon,
        };
    }
    return null;
}
