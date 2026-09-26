import fs from 'fs';

/** Where the api finds the `extension-host` container, and who may connect to it. */
export class ExtensionHostSocket {
  static readonly FILE = 'spawner.sock';
  /** Set on the api when plugin processes are to be started by the `extension-host` container. */
  static readonly ENV = 'EXTENSION_HOST_SOCKET';

  /** The numeric group of `user` from /etc/group — the api's group, the only one allowed to connect. */
  static groupId(user: string, groupFile = '/etc/group'): number {
    const line = fs.readFileSync(groupFile, 'utf8').split('\n').find((entry) => entry.split(':')[0] === user);
    const gid = line ? Number(line.split(':')[2]) : NaN;
    if (!Number.isInteger(gid)) throw new Error(`extension-host: no group "${user}" in ${groupFile}`);
    return gid;
  }
}
