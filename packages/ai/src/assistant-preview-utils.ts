
export class AssistantPreviewUtils {
  static normalizePath(value: any): string | undefined { return AssistantPreviewUtils.normalizePreviewPath(value); }
  static pickPathFromRecord(record: any): string | undefined { return AssistantPreviewUtils.pickPreviewPathFromRecord(record); }
  static toAbsoluteUrl(path?: string): string | undefined { return AssistantPreviewUtils.toAbsolutePreviewUrl(path); }
  static resolveExecutionPaths(item: any): { beforePath?: string; afterPath?: string; currentPath?: string } { return AssistantPreviewUtils.resolveExecutionPreviewPaths(item); }

  static normalizePreviewPath(value: any): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const lowered = raw.toLowerCase();
  if (/^[a-z]+:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return undefined;
  const looksAbsoluteUnixPathCandidate = (pathValue: string) =>
    pathValue.startsWith('/') &&
    (/^\/(users|home|var|private|tmp|opt|etc)\//i.test(pathValue) ||
      /\.(tsx?|jsx?|json|md|css|scss|sass|less|map|lock|log|env)(?:\?.*)?$/i.test(pathValue));
  const looksAbsoluteUnixPath = looksAbsoluteUnixPathCandidate(raw);
  const looksAbsoluteUnixPathWithoutLeadingSlash = /^(users|home|var|private|tmp|opt|etc)\//i.test(raw);
  const looksWindowsPath = /^[a-z]:[\\/]/i.test(raw);
  const looksNetworkPath = /^\\\\/.test(raw);
  const looksBundleAssetPath = /\/(?:src|dist|build|node_modules|themes|plugins)\//i.test(lowered) && /\.[a-z0-9]+(?:\?.*)?$/i.test(raw);
  const looksBundleAssetPathWithoutLeadingSlash =
    /^(?:src|dist|build|node_modules|themes|plugins)\//i.test(raw) && /\.[a-z0-9]+(?:\?.*)?$/i.test(raw);
  if (
    looksAbsoluteUnixPath ||
    looksAbsoluteUnixPathWithoutLeadingSlash ||
    looksWindowsPath ||
    looksNetworkPath ||
    looksBundleAssetPath ||
    looksBundleAssetPathWithoutLeadingSlash
  ) {
    return undefined;
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const pathName = String(parsed.pathname || '').trim();
      const lowerPath = pathName.toLowerCase();
      const remoteLooksFilesystemPath =
        looksAbsoluteUnixPathCandidate(pathName) ||
        /^[a-z]:[\\/]/i.test(pathName) ||
        /\/(?:users|home|var|private|tmp|opt|etc)\//i.test(lowerPath);
      const remoteLooksBundleAssetPath =
        /\/(?:src|dist|build|node_modules|themes|plugins)\//i.test(lowerPath) &&
        /\.[a-z0-9]+(?:\?.*)?$/i.test(pathName);
      if (remoteLooksFilesystemPath || remoteLooksBundleAssetPath) return undefined;
    } catch {
      // keep raw URL if it cannot be parsed defensively
    }
    return raw;
  }
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^\/+/, '')}`;
  }

  static pickPreviewPathFromRecord(record: any): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const keys = ['customPermalink', 'permalink', 'path', 'url', 'slug'];
  for (const key of keys) {
    const path = AssistantPreviewUtils.normalizePreviewPath((record as any)?.[key]);
    if (path) return path;
  }
  return undefined;
  }

  static toAbsolutePreviewUrl(path?: string): string | undefined {
  const normalized = AssistantPreviewUtils.normalizePreviewPath(path);
  if (!normalized) return undefined;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (typeof window === 'undefined') return normalized;
  return `${window.location.origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
  }

  static resolveExecutionPreviewPaths(item: any): { beforePath?: string; afterPath?: string; currentPath?: string } {
  const tool = String(item?.tool || item?.type || '').trim().toLowerCase();
  const isFileMutationTool = tool === 'plugins.files.replace_text' || tool === 'themes.files.replace_text';
  if (isFileMutationTool) {
    return {};
  }
  const output = item?.output && typeof item.output === 'object' ? item.output : {};
  const input = item?.input && typeof item.input === 'object' ? item.input : {};
  const visual = output?.visualPreview && typeof output.visualPreview === 'object' ? output.visualPreview : {};

  const fromInput =
    AssistantPreviewUtils.normalizePreviewPath(input?.permalink) ||
    AssistantPreviewUtils.normalizePreviewPath(input?.path) ||
    AssistantPreviewUtils.normalizePreviewPath(input?.url) ||
    AssistantPreviewUtils.normalizePreviewPath(input?.slug);

  const beforePath =
    AssistantPreviewUtils.normalizePreviewPath(visual?.beforePath) ||
    AssistantPreviewUtils.pickPreviewPathFromRecord(output?.before) ||
    fromInput;

  const afterPath =
    AssistantPreviewUtils.normalizePreviewPath(visual?.afterPath) ||
    AssistantPreviewUtils.normalizePreviewPath(visual?.path) ||
    AssistantPreviewUtils.pickPreviewPathFromRecord(output?.item) ||
    AssistantPreviewUtils.pickPreviewPathFromRecord(output?.after) ||
    fromInput;

  const currentPath = afterPath || beforePath || fromInput;
  return {
    beforePath: beforePath || undefined,
    afterPath: afterPath || undefined,
    currentPath: currentPath || undefined,
  };
  }
}
