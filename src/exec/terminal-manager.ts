// Internal
import * as COMMON from '../common.js';
import { User } from '../models/user.js';
import { Config } from '../config/config.js';
import { localUser } from './username.js';
import type { ICommandQueueItem } from '../shared/interfaces.js';
import * as queueUtils from '../security/queue-utils.js';
import type { CommandQueues } from '../interfaces/queues.js';
import { axiosError } from './backend.js';
import logger from '../logging/logger.js';

// Shared consts
import { ROOT_UID, ROOT_UNAME, INTERNAL_UID, INTERNAL_UNAME, CLEAR_TERMINALS, INIT_TERMINALS } from '../shared/consts.js';

// External
import stripAnsi from 'strip-ansi';
import axios from 'axios';
import os from 'node:os';

// Test mode flag
// When set, all PTY are spawned as root to avoid missing user issues with Docker during testing
export const IS_TEST_MODE = Boolean(process.env.PTY_TEST_MODE);

const hostname = os.hostname();

// Map of Discord user ID to User instances
const users = new Map<string, User>();

// Return pwd for user's PTY
async function getUserPwd(dcUid: string): Promise<string> {
  const user = users.get(dcUid)!;
  const pwd = await execCommand(dcUid, user.dcUname, user.localUser, 'pwd', true);
  return pwd.trim();
}

export async function execCommand(dcUid: string, discosUser: string, localUser: string, command: string, silent: boolean): Promise<string> {
  const user = users.get(dcUid)!; // will exist due to syncing

  // Default command for /dcos exec and /admos root
  if (!command || command.trim() === '') command = 'pwd';

  user.write(command);

  // Heuristic to determine command completion
  //! In very rare edge cases, the response might be cut or incomplete
  //! Interactive commands will leave DiscOS unresponsive (for that command)
  return new Promise((resolve) => {
    const firstLine = IS_TEST_MODE ? `${ROOT_UNAME}@${hostname}` : `${localUser}@${hostname}`; // first line IN the PTY, not of response
    // Only check till : as a cd command could change the cwd

    const interval = setInterval(async () => {
      const clean = stripAnsi(user.buffer);

      const lines = clean.split('\n').map((l) => l.replaceAll('\r', '').trim());

      if (lines.length < 2) return; // Need at least two lines to check

      const lastLine = lines.at(-1);

      if (lastLine?.startsWith(firstLine)) {
        clearInterval(interval);

        // The command output is between the first line and the second occurence of it
        const output = lines.slice(1, -1).join('\n');

        // Clear PTY buffer for next command
        user.buffer = '';

        if (silent) resolve(output);
        else resolve(COMMON.TERMINAL_OUTPUT(discosUser, localUser, hostname, await getUserPwd(dcUid), command, output)); // format for UI
      }

      // If there is no match, keep checking every 100ms
    }, 100);
  });
}

// Spawn PTYs for all allowed users from Config
export async function initTerminalsFromConfig(queues: CommandQueues): Promise<void> {
  if (Config.standalone) {
    if (!users.has(INTERNAL_UID)) users.set(INTERNAL_UID, new User(INTERNAL_UID, INTERNAL_UNAME, ROOT_UNAME)); // internal PTY
    if (!users.has(ROOT_UID)) users.set(ROOT_UID, new User(ROOT_UID, ROOT_UNAME, ROOT_UNAME)); // root/admin PTY

    for (const dcUid of Config.allowedUsers) {
      try {
        if (!users.has(dcUid)) {
          users.set(dcUid, new User(dcUid, '', localUser(dcUid)));
          logger.info(COMMON.terminalSpawnedMessage(dcUid, localUser(dcUid)));
        }
      } catch (err) {
        logger.error(COMMON.terminalSpawnFailedMessage(dcUid), err);
        process.exit(1);
      }
    }
  } else await axiosHelper(queues, INTERNAL_UID, INTERNAL_UNAME, INIT_TERMINALS);
}

// Axios helper
export async function axiosHelper(queues: CommandQueues, user: string, username: string, cmd: string): Promise<void> {
  const validationPayload: ICommandQueueItem = { user: user, username: username, cmd: cmd };
  queueUtils.addToAll(queues, validationPayload);

  try {
    await axios.put(
      Config.backend + '/' + validationPayload.cmd,
      {}, // empty body - EB JSON parser will not fail this way
      {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status < 400,
      }
    );
  } catch {
    axiosError();
  }

  queueUtils.tryRemoveInQueue(queues.validationQueue, validationPayload);
}

// Called when a user is removed by an admin command
// This is called after a mode switch
export async function syncTerminalsWithConfig(switchHappened: boolean, queues: CommandQueues): Promise<void> {
  // Config is kept up-to-date both here and on the potentially used EB
  const allowed = new Set(Config.allowedUsers);
  allowed.add(INTERNAL_UID); // always keep internal PTY
  allowed.add(ROOT_UID); // always keep root (admin) PTY

  // Clear local terminals if a switch happened and current mode is EB
  if (switchHappened && !Config.standalone) destroyAllTerminals();

  // Remove users no longer allowed
  // Only executes if mode was not switched and DiscOS is in standalone mode
  // Otherwise, both the EB and the standalone terminal instances will be fresh and in sync
  if (!switchHappened && Config.standalone) for (const dcUid of users.keys()) if (!allowed.has(dcUid)) destroyTerminalForUser(dcUid, false);

  // Handle sync for EB mode
  if (!switchHappened && !Config.standalone) await axiosHelper(queues, INTERNAL_UID, INTERNAL_UNAME, CLEAR_TERMINALS);

  // Add missing users
  // Both for standalone and EB mode (the func will handle it)
  await initTerminalsFromConfig(queues);

  logger.info(COMMON.terminalSyncCompleteMessage());
}

// Destroy a PTY for a given user identified by a DC UID
export function destroyTerminalForUser(dcUid: string, respawn: boolean = true): void {
  const user = users.get(dcUid)!; // always exists

  user.destroy();
  users.delete(dcUid);

  if (respawn && Config.allowedUsers.includes(dcUid)) users.set(dcUid, new User(dcUid, user.dcUname, user.localUser)); // respawn the PTY for user

  logger.info(COMMON.terminalDestroyedMessage(dcUid, respawn));
}

// Destroys all PTYs and clears the users map
export function destroyAllTerminals(): void {
  for (const dcUid of users.keys()) {
    destroyTerminalForUser(dcUid, false);
  }
  users.clear();
}
