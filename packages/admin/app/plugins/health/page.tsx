"use client";

import React from 'react';
import PluginHealthPageClient from './page-client';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function PluginHealthPage(): React.ReactNode {
  return <PluginHealthPageClient />;
}
