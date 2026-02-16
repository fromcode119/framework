"use client";

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PluginSettingsRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/plugins/${slug}?tab=settings`);
  }, [router, slug]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

