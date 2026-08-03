export interface IDynamicFieldState {
  dynamicFieldOptions: Record<string, Array<{ label: string; value: string }>>;
  dynamicFieldErrors: Record<string, string>;
  dynamicFieldLoading: Record<string, boolean>;
}
