export interface AsyncDataControllerCallbacks<T> {
  onError?: (error: Error) => void;
  onStart?: () => void;
  onSuccess: (result: T) => void;
}
