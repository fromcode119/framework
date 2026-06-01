"use client";

import React from 'react';
import UserSecurityPageClient from './page-client';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function UserSecurityPage(): React.ReactNode {
  return <UserSecurityPageClient />;
}
