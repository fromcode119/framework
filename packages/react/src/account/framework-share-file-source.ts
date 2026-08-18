import { ApiVersionUtils, ApplicationUrlUtils, FileRoutePaths, SdkClient } from '@fromcode119/core/client';
import type { IAccountFileGroup } from '@react/account/interfaces/account-file-group.interface';
import type { IAccountFileSourceContext } from '@react/account/interfaces/account-file-source-context.interface';

/**
 * The framework's own contribution: files an operator sent this person directly.
 *
 * Registered like any plugin source rather than special-cased inside the panel, so the panel has no
 * privileged branch and the framework's files sort by the same rule as everyone else's.
 *
 * That means it must satisfy the same contract the plugins do — `static fileSource` + `static loadFiles`.
 * It first shipped with instance members instead, and the registry, which looks up a STATIC `loadFiles`,
 * silently treated it as "not a file source": the account panel showed course materials and nothing an
 * operator had actually sent, while the endpoint behind it was returning the shares correctly.
 */
export class FrameworkShareFileSource {
  static readonly fileSource = { key: 'framework.shares', priority: 10, labelKey: 'account.files.sentToYou' };

  static async loadFiles(context: IAccountFileSourceContext): Promise<IAccountFileGroup[]> {
    const response = await new SdkClient(context.api as any).getFiles().get(FileRoutePaths.mySharesScoped(), { silent: true });
    const shares = response?.data ?? (Array.isArray(response) ? response : []);
    if (!Array.isArray(shares)) return [];

    return shares.map((share: any) => FrameworkShareFileSource.toGroup(share, context));
  }

  private static toGroup(share: any, context: IAccountFileSourceContext): IAccountFileGroup {
    const remaining = share?.downloadsRemaining;

    return {
      title: String(share?.title || ''),
      // No badge when the allowance is unlimited — a "∞ left" chip is noise, and a number nobody set
      // would be worse.
      badge: remaining === null || remaining === undefined
        ? undefined
        : { label: context.t('account.files.remaining', { count: remaining }), tone: 'warning' as const },
      files: (share?.files || []).map((file: any) => ({
        id: file.id,
        name: String(file.name || ''),
        size: Number(file.size || 0),
        // Session-authenticated: the server re-derives entitlement from the signed-in address, so this
        // link is useless to anyone else and carries no token.
        href: ApplicationUrlUtils.joinApiPath(
          ApplicationUrlUtils.inferBrowserBaseUrl('api'),
          `${ApiVersionUtils.prefix()}${FileRoutePaths.myDownload(share.id, file.id)}`,
        ),
      })),
    };
  }
}
