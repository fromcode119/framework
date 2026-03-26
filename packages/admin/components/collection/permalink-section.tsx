import React from 'react';
import { Card } from '@/components/ui/card';
import { PermalinkInput } from '@/components/ui/permalink-input';
import type { Collection } from '@fromcode119/core/client';

interface PermalinkSectionProps {
  value: string;
  slug: string;
  id?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  collection?: Collection;
  pluginSettings?: Record<string, any>;
}

export const PermalinkSection: React.FC<PermalinkSectionProps> = ({
  value,
  slug,
  id,
  onChange,
  disabled,
  collection,
  pluginSettings
}) => {
  return (
    <Card title="Preview & Permalink">
        <PermalinkInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          id={id}
          slug={slug}
          collection={collection}
          pluginSettings={pluginSettings}
        />
        <p className="mt-2 text-[12px] text-slate-400 font-bold uppercase tracking-tight opacity-50">
          Click the path component to override the automatically generated slug.
        </p>
    </Card>
  );
};
