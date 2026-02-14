import { useState, useCallback, FormEvent } from 'react';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

interface UseCollectionFormOptions {
  collectionSlug: string;
  initialData?: Record<string, any>;
  isNew: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useCollectionForm({
  collectionSlug,
  initialData = {},
  isNew,
  onSuccess,
  onError
}: UseCollectionFormOptions) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isDirty, setIsDirty] = useState(false);

  const setFieldValue = useCallback((name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
    // Clear error for this field when changed
    setErrors(prev => {
      if (!prev[name]) return prev;
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  const handleSubmit = async (e?: FormEvent, summary?: string) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const url = isNew 
        ? `${ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}` 
        : `${ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}/${formData.id || initialData.id}`;

      // Attach change summary if provided
      const payload = summary ? { ...formData, _change_summary: summary } : formData;

      const result = await (isNew ? api.post(url, payload) : api.put(url, payload));
      
      setIsDirty(false);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err: any) {
      console.error('Form submission error:', err);
      
      let message = 'Operation failed';
      let fieldErrors: Record<string, string[]> = {};

      if (err.data?.errors) {
        // If it's an array of strings like ["Field X is required"]
        if (Array.isArray(err.data.errors)) {
          message = err.data.errors.join(', ');
          setErrors({ base: err.data.errors });
        } else if (typeof err.data.errors === 'object') {
          // If it's an object like { fieldName: ['error1'] }
          fieldErrors = err.data.errors;
          setErrors(fieldErrors);
          message = Object.values(fieldErrors).flat().join(', ');
        }
      } else {
        message = err.message || 'Operation failed';
        setErrors({ base: [message] });
      }

      if (onError) onError({ ...err, message });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setIsDirty(false);
  }, [initialData]);

  return {
    formData,
    setFormData,
    setFieldValue,
    handleSubmit,
    isSubmitting,
    errors,
    isDirty,
    reset
  };
}
