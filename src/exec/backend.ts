import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Config file
import { Config } from '../config/config.js';

// Interfaces
import type { ICommandQueueItem, IFileWritePayload } from '../shared/interfaces.js';

// Types
import type { DB } from '../shared/types.js';

// Consts
import * as COMMON from '../common.js';
import { PING_RESPONSE, DB_UPDATE, INTERNAL_UID, INTERNAL_UNAME } from '../shared/consts.js';
const WRITE_OP_SUCCESS = '';

// Helpers
import type { CommandQueues } from '../interfaces/queues.js';
import * as queueUtils from '../security/queue-utils.js';
import { execCommand } from './terminal-manager.js';
import { localUser } from './username.js';
import logger from '../logging/logger.js';

// Exec-related
import shellEscape from 'shell-escape';

// File system
import path from 'node:path';
import fs from 'node:fs';

// Axios error handling
export function axiosError(): void {
  logger.error(COMMON.NETWORK_ERR);
  process.exit(1);
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

// File write sequence
async function fileWrite(url: string, _path: string, payload: ICommandQueueItem): Promise<string> {
  // Escaped path and URL
  const escapedPath: string = shellEscape([_path]);

  // Get the server user based on the Discord UID
  const serverUser: string = localUser(payload.user);

  // The output buffer for the command executions
  let stdout: string;

  // Check if the user provided path is (an existing) dir
  const dirName = path.dirname(_path);
  if (!fs.existsSync(dirName) || !fs.lstatSync(dirName).isDirectory()) return COMMON.EB_DIR_ERR;

  // Test if the user has permission to write to the file (while creating the neccessary directories)
  const testPermissionCmd = `mkdir -p ${dirName} ` + `&& > ${escapedPath}`;
  stdout = await execCommand(payload.user, payload.username, serverUser, testPermissionCmd, true);
  if (stdout.trim() !== '') return COMMON.EB_PERM_ERR;

  // Download the file from Discord CDN
  // Escape URL so curl will not fail
  const curlCmd = `curl -fsSL ${shellEscape([url])} -o ${escapedPath}`;

  stdout = await execCommand(payload.user, payload.username, serverUser, curlCmd, true);
  if (stdout.trim() !== '') return COMMON.EB_DOWNLOAD_ERR;

  // Set the file permissions
  // curl is used by the pty user, so the owner is already correct
  fs.chmodSync(_path, 0o660);

  return WRITE_OP_SUCCESS;
}

// Post command to EB or execute locally
export async function post(payload: ICommandQueueItem, b64decode: boolean, silent: boolean): Promise<AxiosResponse<any, any>> {
  let res: AxiosResponse<any, any> = internalAxiosResponse('', 500); // dummy init

  if (Config.standalone) {
    const output = await execCommand(payload.user, payload.username, localUser(payload.user), payload.cmd, silent);
    res = internalAxiosResponse(b64decode ? Buffer.from(output.toString(), 'base64') : output, 200);
  } else {
    try {
      res = await axios.post(Config.backend, payload, {
        responseType: 'text',
        validateStatus: (status) => status < 400,
      });
    } catch {
      axiosError();
    }
    if (b64decode) res.data = Buffer.from(res.data as string, 'base64'); // Convert base64 encoded response to Buffer
  }

  return res;
}

// Put file to EB or handle locally
export async function put(req: IFileWritePayload): Promise<AxiosResponse<any, any>> {
  let res: AxiosResponse<any, any> = internalAxiosResponse('', 500); // dummy init

  if (Config.standalone) {
    const internalResponse = await fileWrite(req.url, req.path, req.payload);
    return internalAxiosResponse(internalResponse, internalResponse === WRITE_OP_SUCCESS ? 200 : 500);
  } else {
    try {
      res = await axios.put(Config.backend, req, {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status < 400,
      });
    } catch {
      axiosError();
    }
  }

  return res;
}

// Pings the external backend, return a message based on the result
export async function ping(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await axios.get(Config.backend, {
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 300,
      signal: controller.signal,
    });

    // The backend may be down, but the reverse proxy redirected to a default page (HTTP code wouldn't fail)
    if ((res.data as string).trim() !== PING_RESPONSE) {
      throw new Error(COMMON.EXTERNAL_NORESPONSE);
    }

    logger.info(COMMON.EXTERNAL_OK);
    return COMMON.EXTERNAL_OK;
  } catch (err) {
    if (err instanceof Error) logger.error(err.message);
    else logger.error(String(err));
    axiosError();
    return COMMON.EXTERNAL_NORESPONSE; // unreachable, no effect
  } finally {
    clearTimeout(timeout);
  }
}

// Updates the external backend's database by sending the local database content
export async function updateExternalBackendDatabase(database: DB, queues: CommandQueues): Promise<void> {
  const validationPayload: ICommandQueueItem = { user: INTERNAL_UID, username: INTERNAL_UNAME, cmd: DB_UPDATE };
  queueUtils.addToAll(queues, validationPayload);

  try {
    await axios.put(Config.backend + '/' + DB_UPDATE, database, {
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: (status) => status <= 500,
    });
  } catch {
    // Any non-HTTP but network error (e.g. DNS resolution failure)
    logger.error(COMMON.NETWORK_ERR);
  }

  queueUtils.tryRemoveInQueue(queues.validationQueue, validationPayload);
}
