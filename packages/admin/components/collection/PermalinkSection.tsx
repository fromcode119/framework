import React from 'react';
import { Card } from '@/components/ui/Card';
import { PermalinkInput } from '@/components/ui/PermalinkInput';

interface PermalinkSectionProps {
  value: string;
  slug: string;
  id?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const PermalinkSection: React.FC<PermalinkSectionProps> = ({
  value,
  slug,
  id,
  onChange,
  disabled
}) => {
  return (
    <Card title="Preview & Permalink">
        <PermalinkInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          id={id}
          slug={slug}
        />
        <p className="mt-2 text-[12px] text-slate-400 font-bold uppercase tracking-tight opacity-50">
          Click the path component to override the automatically generated slug.
        </p>
    </Card>
  );
};
