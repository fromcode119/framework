import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginContextSigning } from '@core/plugin/interfaces/plugin-context-signing.interface';

/**
 * `context.signing` — see {@link IPluginContextSigning}.
 *
 * Built on the HOST in both worlds, so an isolated plugin reaches it over RPC and receives a
 * signature or a boolean, never the key. The purpose is `<plugin slug>.<name>`, which is exactly the
 * purpose every plugin already passed to `SigningSecretService.signingKey`, so the derived keys — and
 * every token already sent — are unchanged.
 */
export class SigningContextProxy {
  static createSigningProxy(manager: IPluginManagerInterface, pluginSlug: string): IPluginContextSigning {
    const keyFor = (name: string): Promise<string> => {
      const suffix = String(name ?? '').trim();
      if (!suffix) throw new Error(`${SigningSecretService.UNAVAILABLE}: a signing name is required`);
      return SigningSecretService.signingKey(MetaContextProxy.createMetaProxy(manager), `${pluginSlug}.${suffix}`);
    };

    return {
      sign: async (name: string, message: string): Promise<string> =>
        SigningSecretService.sign(await keyFor(name), message),
      verify: async (name: string, message: string, signature: string): Promise<boolean> =>
        SigningSecretService.verify(await keyFor(name), message, signature),
    };
  }
}
