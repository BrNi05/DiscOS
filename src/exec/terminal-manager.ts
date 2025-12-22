// Internal
import * as COMMON from '../common.js';
import { User } from '../models/user.js';
import { Config } from '../config/config.js';
import { localUser } from './username.js';
import logger from '../logging/logger.js';

// Node PTY and related
import stripAnsi from 'strip-ansi';

// OS
import os from 'node:os';
import { ROOT_UID, ROOT_UNAME } from '../shared/consts.js';
const hostname = os.hostname();

// Test mode flag
export const IS_TEST_MODE = Boolean(process.env.PTY_TEST_MODE);

// Map of Discord user ID to User instances
const users = new Map<string, User>();

// Internal root PTY session
export const INTERNAL_UID = '0';
export const INTERNAL_UNAME = 'DiscOS-Internal';
const internalPty = new User(INTERNAL_UID, INTERNAL_UNAME, 'root');

// Returns the User instance for a given Discord user ID
// Creates a new User if one does not exist
function getUser(dcUid: string, dcUname: string, localUser: string): User {
  if (!users.has(dcUid)) {
    users.set(dcUid, new User(dcUid, dcUname, localUser));
  }
  return users.get(dcUid)!;
}

export async function execCommand(dcUid: string, discosUser: string, localUser: string, command: string, silent: boolean): Promise<string> {
  const user = getUser(dcUid, discosUser, localUser);

  // Default command for /dcos exec and /admos root
  if (!command || command.trim() === '') command = 'pwd';

  user.write(command);

  // Heuristic to determine command completion
  //! In very rare edge cases, the response might be cut or incomplete
  //! Interactive commands will leave DiscOS unresponsive (for that command)
  return new Promise((resolve) => {
    const firstLine = IS_TEST_MODE ? `${ROOT_UNAME}@${hostname}` : `${localUser}@${hostname}`; // first line IN the PTY, not of response
    // Only check till : as a cd command could change the cwd

    const interval = setInterval(() => {
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
        else resolve(COMMON.TERMINAL_OUTPUT(discosUser, localUser, hostname, '~', command, output)); // format for UI
      }

      // If there is no match, keep checking every 100ms
    }, 100);
  });
}

// Spawn PTYs for all allowed users from Config
export async function initTerminalsFromConfig(): Promise<void> {
  if (!users.has(internalPty.dcUid)) users.set(internalPty.dcUid, internalPty); // internal PTY
  if (!users.has(ROOT_UID)) users.set(ROOT_UID, new User(ROOT_UID, ROOT_UNAME, ROOT_UNAME)); // root/admin PTY

  for (const dcUid of Config.allowedUsers) {
    try {
      if (!users.has(dcUid)) {
        users.set(dcUid, new User(dcUid, '', await localUser(dcUid)));
        logger.info(COMMON.terminalSpawnedMessage(dcUid, await localUser(dcUid)));
      }
    } catch (err) {
      logger.error(COMMON.terminalSpawnFailedMessage(dcUid), err);
    }
  }
}

// Destroy a PTY for a given user identified by a DC UID
export function destroyTerminalForUser(dcUid: string, respawn: boolean = true): void {
  const user = users.get(dcUid); // always exists

  user!.destroy();
  users.delete(dcUid);

  if (respawn && Config.allowedUsers.includes(dcUid)) {
    getUser(dcUid, user!.dcUname, user!.localUser);
  }

  logger.info(COMMON.terminalDestroyedMessage(dcUid, respawn));
}

// Called when a user is removed by an admin command
export async function syncTerminalsWithConfig(): Promise<void> {
  const allowed = new Set(Config.allowedUsers);
  allowed.add(INTERNAL_UID); // always keep internal PTY
  allowed.add(ROOT_UID); // always keep root (admin) PTY

  // Remove users no longer allowed
  for (const dcUid of users.keys()) {
    if (!allowed.has(dcUid)) destroyTerminalForUser(dcUid, false);
  }

  // Add missing users
  await initTerminalsFromConfig();

  logger.info(COMMON.terminalSyncCompleteMessage());
}
