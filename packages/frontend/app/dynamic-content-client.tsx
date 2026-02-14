"use client";

import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';

type DynamicContentClientProps = {
  content: any;
};

export default function DynamicContentClient({ content }: DynamicContentClientProps) {
  const { themeLayouts } = usePlugins();

  const selectedLayoutName = content.themeLayout || 'DefaultLayout';
  const LayoutComponent =
    themeLayouts?.[selectedLayoutName] ||
    themeLayouts?.DefaultLayout ||
    (({ children }: any) => <>{children}</>);

  return (
    <LayoutComponent page={content}>
      <div className="w-full">
        <Slot name="frontend.content.display" props={{ content: content.content }} />

        {(!content.content || typeof content.content === 'string') && (
          <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto py-12 px-6">
            <h1 className="text-4xl font-black mb-8">{content.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: content.content || '' }} />
          </div>
        )}

        <Slot name="frontend.content.footer" props={{ content }} />
      </div>
    </LayoutComponent>
  );
}
