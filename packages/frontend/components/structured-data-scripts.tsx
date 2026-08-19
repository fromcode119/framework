/**
 * Server Component: the page's JSON-LD structured data, rendered as ld+json script blocks.
 *
 * Lives in the page BODY tree because Next's Metadata API carries no structured data — crawlers read
 * ld+json anywhere in the document. The payloads come from the head-data provider plugin (the SEO
 * plugin's schema builders), which serializes and `</script>`-escapes them itself; they are never
 * assembled from request input in this process, which is what makes the raw injection sound.
 */
export class StructuredDataScriptsView {
  static render({ schema }: { schema: string[] }) {
    if (!schema.length) return null;
    return (
      <>
        {schema.map((json, index) => (
          // eslint-disable-next-line react/no-danger
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: StructuredDataScriptsView.neutralizeCloseTags(json) }} />
        ))}
      </>
    );
  }

  /**
   * Defense in depth on top of the provider's own escaping: `</` inside JSON can only occur within
   * string values, where `<\/` is the same string — so this neutralizes any script-close injection
   * without changing the parsed data, and is a no-op on already-escaped payloads.
   */
  private static neutralizeCloseTags(json: string): string {
    return json.replace(/<\//g, '<\\/');
  }
}
