import { useEffect, useState } from 'react';
import { slugify } from '../../../lib/utils';

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

  useEffect(() => {
    if (isNew && !internalManuallyEdited && sourceValue) {
      const newSlug = slugify(sourceValue);
      onSlugGenerate(newSlug);
    }
  }, [sourceValue, isNew, internalManuallyEdited, onSlugGenerate]);

  return {
    manuallyEdited: internalManuallyEdited,
    setManuallyEdited: setInternalManuallyEdited
  };
}
