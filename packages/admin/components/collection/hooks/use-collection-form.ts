import { useState, useCallback, FormEvent } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

interface UseCollectionFormOptions {
  collectionSlug: string;
  initialData?: Record<string, any>;
  isNew: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  getSubmitMetadata?: () => Record<string, any>;
  preparePayload?: (payload: Record<string, any>) => Record<string, any>;
}

export function useCollectionForm({
  collectionSlug,
  initialData = {},
  isNew,
  onSuccess,
  onError,
  getSubmitMetadata,
  preparePayload
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
        ? `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}` 
        : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}/${formData.id || initialData.id}`;

      const submitMetadata = getSubmitMetadata ? getSubmitMetadata() : {};
      const payloadBase = { ...formData, ...(submitMetadata || {}) };
      const normalizedPayloadBase = preparePayload ? preparePayload(payloadBase) : payloadBase;
      const payload = summary ? { ...normalizedPayloadBase, _change_summary: summary } : normalizedPayloadBase;

      const result = await (isNew ? AdminApi.post(url, payload) : AdminApi.put(url, payload));
      
      setIsDirty(false);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err: any) {
      console.error('Form submission error:', err);
      
      let message = 'Operation failed';
      let fieldErrors: Record<string, string[]> = {};

      if (err.data?.errors) {
        // API returns [{ field: 'fieldName', message: '...' }, ...] or { fieldName: ['msg'] }
        if (Array.isArray(err.data.errors)) {
          const errorItems = err.data.errors as Array<any>;
          message = errorItems
            .map((e) => (typeof e === 'string' ? e : e.message || e.field || 'Validation error'))
            .join(', ');
          // Build per-field map so individual inputs can highlight
          const perField: Record<string, string[]> = {};
          for (const e of errorItems) {
            if (e && typeof e === 'object' && e.field) {
              const key = String(e.field);
              if (!perField[key]) perField[key] = [];
              perField[key].push(typeof e.message === 'string' ? e.message : String(e.message ?? e));
            }
          }
          setErrors(Object.keys(perField).length ? perField : { base: [message] });
        } else if (typeof err.data.errors === 'object') {
          // Object like { fieldName: ['error1'] }
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
