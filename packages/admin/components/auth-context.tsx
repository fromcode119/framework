"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthProviderView } from './auth-provider-view';

/**
 * Thin functional shim — reads the `useRouter()` hook and hands it to the hook-free
 * {@link AuthProviderView} class, which holds the user/isLoading state and the hydrate effect.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <AuthProviderView router={router}>{children}</AuthProviderView>;
}
