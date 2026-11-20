/**
 * Reads an import file. The import endpoint takes a list of records — the shape the JSON export writes —
 * so anything else (not JSON, an object, an empty list) is refused here, before any record is created.
 */
export class ListImportFile {
  static records(text: string): unknown[] | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.every((record) => record !== null && typeof record === 'object' && !Array.isArray(record)) ? parsed : null;
  }
}
