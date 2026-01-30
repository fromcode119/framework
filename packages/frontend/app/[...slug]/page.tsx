"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePlugins, Slot } from '@fromcode/react';

export default function DynamicContentPage() {
  const params = useParams();
  const slugArray = params.slug as string[];
  const slug = slugArray.join('/');
  
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { themeLayouts, resolveContent } = usePlugins();

  useEffect(() => {
    async function fetchContent() {
      try {
        const result = await resolveContent(slug);
        if (result && result.doc) {
          setContent(result.doc);
        }
      } catch (err) {
        console.error("Content Resolve Error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) fetchContent();
  }, [slug, resolveContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h1 className="text-6xl font-black text-slate-200">404</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest">Page not found</p>
        <a href="/" className="text-indigo-500 font-bold hover:underline">Return Home</a>
      </div>
    );
  }

  // Determine which layout to use
  const selectedLayoutName = content.themeLayout || 'DefaultLayout';
  const LayoutComponent = themeLayouts?.[selectedLayoutName] || themeLayouts?.['DefaultLayout'] || (({ children }: any) => <>{children}</>);

  return (
    <LayoutComponent page={content}>
      <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
        <h1 className="text-4xl font-black mb-8">{content.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: content.content }} />
        
        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
          <Slot name="frontend.content.footer" props={{ content }} />
        </div>
      </div>
    </LayoutComponent>
  );
}
