import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface UseSlugValidationOptions {
  slug: string;
  collectionSlug: string;
  currentId?: string;
  isNew: boolean;
}

export function useSlugValidation({
  slug,
  collectionSlug,
  currentId,
  isNew
}: UseSlugValidationOptions) {
  const [warning, setWarning] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!slug || !collectionSlug) {
      setWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const query = `?slug=${encodeURIComponent(slug)}&limit=10`;
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}${query}`);
        
        const results = response.docs || [];
        
        if (Array.isArray(results) && results.length > 0) {
          const duplicate = results.find((item: any) => isNew || String(item.id) !== String(currentId));
          setWarning(
            duplicate
              ? `This slug is already taken by "${duplicate.name || duplicate.title || duplicate.id}".`
              : null
          );
        } else {
          setWarning(null);
        }
      } catch (err) {
        // Silent fail for validation helper
      } finally {
        setIsValidating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, collectionSlug, currentId, isNew]);

  return {
    warning,
    isValidating
  };
}
