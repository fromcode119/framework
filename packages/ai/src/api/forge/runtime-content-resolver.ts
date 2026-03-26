export class AssistantRuntimeContentResolver {
  constructor(
    private readonly restController: any,
    private readonly user: any,
    private readonly headers: any,
    private readonly cookies: any,
  ) {}

  async resolveContentItem(collection: any, selector: any): Promise<any> {
    const rawCollection: any = collection.raw || collection;
    const primaryKey = String(rawCollection?.primaryKey || 'id');
    const fieldNames = Array.isArray(rawCollection?.fields)
      ? rawCollection.fields.map((field: any) => String(field?.name || '').trim()).filter(Boolean)
      : [];
    const idCandidate = selector?.id;

    if (idCandidate !== undefined && idCandidate !== null && String(idCandidate).trim() !== '') {
      const rawId = String(idCandidate).trim();
      const numericId = Number(rawId);
      const canUseIdLookup = primaryKey !== 'id' || Number.isInteger(numericId);

      if (canUseIdLookup) {
        try {
          const foundByPrimary = await this.restController.findOne(rawCollection, {
            params: { id: primaryKey === 'id' ? String(numericId) : rawId },
            query: { preview: true },
            user: this.user,
            headers: this.headers,
            cookies: this.cookies,
          });
          if (foundByPrimary) return foundByPrimary;
        } catch {
          // Fall back to field-based lookup.
        }
      }

      const idCandidates = Array.from(
        new Set([primaryKey, 'id', '_id', 'uuid'].filter((field) => fieldNames.includes(field))),
      );
      const valuesToTry = Number.isFinite(numericId) && String(numericId) === rawId ? [numericId, rawId] : [rawId];

      for (const field of idCandidates) {
        for (const candidateValue of valuesToTry) {
          try {
            const result = await this.restController.find(rawCollection, {
              query: { [field]: candidateValue, limit: 1, offset: 0, preview: true },
              user: this.user,
              headers: this.headers,
              cookies: this.cookies,
            });
            if (Array.isArray(result?.docs) && result.docs.length) return result.docs[0];
          } catch {
            // Try next candidate field/value.
          }
        }
      }
    }

    const where = selector?.where && typeof selector.where === 'object' ? selector.where : null;
    if (where) {
      const result = await this.restController.find(rawCollection, {
        query: { ...where, limit: 1, offset: 0, preview: true },
        user: this.user,
        headers: this.headers,
        cookies: this.cookies,
      });
      return Array.isArray(result?.docs) && result.docs.length ? result.docs[0] : null;
    }

    const slugCandidate = String(selector?.slug || '').trim();
    const permalinkCandidate = String(selector?.permalink || '').trim();
    const fallbackValue = slugCandidate || permalinkCandidate;
    if (!fallbackValue) return null;

    const priorityFields = ['slug', 'permalink', 'customPermalink', 'path', 'url', 'title', 'name', 'label', primaryKey];
    const candidates = Array.from(new Set(priorityFields.filter((field) => fieldNames.includes(field))));
    if (candidates.length === 0) return null;

    for (const field of candidates) {
      try {
        const result = await this.restController.find(rawCollection, {
          query: { [field]: fallbackValue, limit: 1, offset: 0, preview: true },
          user: this.user,
          headers: this.headers,
          cookies: this.cookies,
        });
        if (Array.isArray(result?.docs) && result.docs.length) return result.docs[0];
      } catch {
        // Try next candidate field.
      }
    }

    return null;
  }
}
