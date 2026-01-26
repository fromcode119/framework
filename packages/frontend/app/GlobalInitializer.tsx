"use client";

import React from 'react';
import ReactDOM from 'react-dom';
import { FrameworkIcons } from '../lib/icons';
import { getIcon } from '@fromcode/react';

export default function GlobalInitializer() {
    if (typeof window !== 'undefined') {
        (window as any).React = React;
        (window as any).ReactDOM = ReactDOM;
        (window as any).FrameworkIcons = FrameworkIcons;
        (window as any).getIcon = getIcon;
    }
    return null;
}
