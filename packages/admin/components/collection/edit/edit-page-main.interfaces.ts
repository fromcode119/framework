export interface EditPageMainProps {
  standardMainFieldSections: Array<{ key: string; title?: string; fields: any[] }>;
  fullWidthMainFieldSections: Array<{ key: string; title?: string; fields: any[] }>;
  theme: string;
  resolvedSlug: string;
  formData: Record<string, any>;
  pluginSettings: Record<string, any>;
  fieldErrors: Record<string, any>;
  saving: boolean;
  isNew: boolean;
  slugWarning?: string | null;
  slugManuallyEdited?: boolean;
  readOnlyOverrideFields: Record<string, true>;
  handleInputChange: (name: string, value: any) => void;
  handlePatch: (partial: Record<string, any>) => void;
  handleReadOnlyOverrideRequest: (target: { name: string; label: string }) => void;
}
