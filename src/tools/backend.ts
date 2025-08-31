import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { AxiosResponse } from 'axios';

// Config file
import { Config } from '../config';

// Interfaces
import type { ICommandQueueItem, IFileWritePayload } from '../shared/interfaces';

// Consts
import * as COMMON from '../common';
import { ROOT_UID } from '../shared/consts';
const WRITE_OP_SUCCESS = '';

// Exec-related
import shellEscape from 'shell-escape';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
const execAsync = promisify(exec);

// Determines local user (based on Discord UID)
async function localUser(user: string): Promise<string> {
  // Handle root user (for admos root <command>)
  if (user === ROOT_UID) {
    return 'root';
  }

  const dbContent: string = await readFile(Config.databasePath, 'utf-8');
  const dbParsed = JSON.parse(dbContent) as {
    users: Record<string, string>;
  };

  // Cannot be null, since only an allowedUser can send commands
  const serverUser: string = dbParsed.users[user];

  return shellEscape([serverUser]);
}

// Axios response creation
function internalAxiosResponse(data: any, status: number): AxiosResponse<any, any> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    data: data,
    status: status,
    statusText: '',
    headers: {},
    config: {
      headers: {},
    } as InternalAxiosRequestConfig,
  };
}

// Command executor
async function spawnChild(user: string, command: string): Promise<Buffer> {
  try {
    const cmd = shellEscape([command]);
    const serverUser: string = await localUser(user);
    const { stdout } = await execAsync(`sudo /usr/local/bin/cmdex ${serverUser} ${cmd}`, {
      encoding: 'buffer',
      maxBuffer: 1000 * 1000 * Config.fileMaxSize * 1.34, // Max buffer size (taking base64 encode overhead into account)
    });

    return stdout;
  } catch {
    return Buffer.from(COMMON.SPAWN_ERR);
  }
}

// File write sequence
async function fileWrite(url: string, path: string, payload: ICommandQueueItem): Promise<string> {
  // Escaped path and URL
  const escapedPath: string = shellEscape([path]);
  const safeUrl = shellEscape([url]);

  // Check child process spawning
  try {
    const { stdout } = await execAsync(`sudo /usr/local/bin/cmdex root whoami`);
    if (stdout.trim() !== 'root') {
      return COMMON.SPAWN_ERR;
    }
  } catch {
    return COMMON.SPAWN_ERR;
  }

  // Get the server user based on the Discord UID
  const serverUser: string = await localUser(payload.user);

  // Check if the user provided path is (an existing) dir
  const isDirCmd = shellEscape([`[ -d ${escapedPath} ] && echo 1 || echo 0`]);
  let { stdout } = await execAsync(`sudo /usr/local/bin/cmdex ${serverUser} ${isDirCmd}`);
  if (stdout.trim() === '1') {
    return COMMON.DIR_ERR;
  }

  // Test if the user has permission to write to the file (while creating the neccessary directories)
  const testPermissionCmd = shellEscape([`mkdir -p "$(dirname ${escapedPath})" && echo > ${escapedPath} && rm -f ${escapedPath}`]);
  ({ stdout } = await execAsync(`sudo /usr/local/bin/cmdex ${serverUser} ${testPermissionCmd}`));
  if (stdout.trim() !== '') {
    return COMMON.PERM_ERR;
  }

  // Download the file from Discord CDN
  const curlCmd = shellEscape([`curl -fsSL ${safeUrl} -o ${escapedPath}`]);
  ({ stdout } = await execAsync(`sudo /usr/local/bin/cmdex ${serverUser} ${curlCmd}`));
  if (stdout.trim() !== '') {
    return COMMON.DOWNLOAD_ERR;
  }

  // Set the file permissions to 660
  const getHomeCmd = shellEscape(['echo $HOME']);
  ({ stdout } = await execAsync(`sudo /usr/local/bin/cmdex ${serverUser} ${getHomeCmd}`));
  const userHomeDir: string = stdout.trim();

  const permCmd = shellEscape([`cd ${userHomeDir} && chown ${serverUser}:${serverUser} ${escapedPath} && chmod 644 ${escapedPath}`]);
  ({ stdout } = await execAsync(`sudo /usr/local/bin/cmdex root ${permCmd}`));
  if (stdout.trim() !== '') {
    return COMMON.SET_PERM_ERR;
  }

  return WRITE_OP_SUCCESS;
}

export async function post(payload: ICommandQueueItem, b64decode: boolean): Promise<AxiosResponse<any, any>> {
  let res: AxiosResponse<any, any>;

  if (Config.standalone) {
    const output = await spawnChild(payload.user, payload.cmd);
    res = internalAxiosResponse(b64decode ? Buffer.from(output.toString(), 'base64') : output, 200);
  } else {
    res = await axios.post(Config.backend, payload, {
      responseType: 'text',
      validateStatus: (status) => status <= 500,
    });
    if (b64decode) res.data = Buffer.from(res.data as string, 'base64'); // Convert base64 encoded response to Buffer
  }

  return res;
}

export async function put(req: IFileWritePayload): Promise<AxiosResponse<any, any>> {
  let res: AxiosResponse<any, any>;

  if (Config.standalone) {
    const internalResponse = await fileWrite(req.url, req.path, req.payload);
    return internalAxiosResponse(internalResponse, internalResponse === WRITE_OP_SUCCESS ? 200 : 500);
  } else {
    res = await axios.put(Config.backend, req, {
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: (status) => status <= 500,
    });
  }

  return res;
}
