import { useEffect, useState, useCallback } from 'react';

interface UseSlugGenerationOptions {
  sourceValue: string;
  isNew: boolean;
  manuallyEdited: boolean;
  onSlugGenerate: (slug: string) => void;
}

export function useSlugGeneration({
  sourceValue,
  isNew,
  manuallyEdited,
  onSlugGenerate
}: UseSlugGenerationOptions) {
  const [internalManuallyEdited, setInternalManuallyEdited] = useState(manuallyEdited);

  const slugify = useCallback((text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-');  // Replace multiple - with single -
  }, []);

  useEffect(() => {
    if (isNew && !internalManuallyEdited && sourceValue) {
      const newSlug = slugify(sourceValue);
      onSlugGenerate(newSlug);
    }
  }, [sourceValue, isNew, internalManuallyEdited, slugify, onSlugGenerate]);

  return {
    manuallyEdited: internalManuallyEdited,
    setManuallyEdited: setInternalManuallyEdited
  };
}
