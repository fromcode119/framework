export class ApiQueryUtils {
  static build(params?: Record<string, unknown>): string {
    const search = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry === undefined || entry === null || entry === '') {
            return;
          }

          search.append(key, String(entry));
        });
        return;
      }

      search.set(key, String(value));
    });

    const query = search.toString();
    return query ? `?${query}` : '';
  }
}
