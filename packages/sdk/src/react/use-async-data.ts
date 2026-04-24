import React from 'react';

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  deps: React.DependencyList,
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    return () => { active = false; };
  }, deps);

  return { data, loading, error };
}
