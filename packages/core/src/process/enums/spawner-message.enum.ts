import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Every message an api and its privileged spawner exchange — the spawner forked beside it, or the
 * `extension-host` container's. Carried as a VALUE on the wire; the enum is where the list lives.
 */
export class SpawnerMessage extends Enum {
  // api → spawner
  static readonly PING = new SpawnerMessage('ping');
  static readonly PREPARE = new SpawnerMessage('prepare');
  static readonly SPAWN = new SpawnerMessage('spawn');
  static readonly INVENTORY = new SpawnerMessage('inventory');
  static readonly CLAIM = new SpawnerMessage('claim');
  static readonly KILL = new SpawnerMessage('kill');
  // spawner → api
  static readonly EXIT = new SpawnerMessage('exit');
  static readonly OUTPUT = new SpawnerMessage('output');
}
