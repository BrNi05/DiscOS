// IPC server socket path
export const SOCKET_PATH: string = '/tmp/discos.sock';

// User ID for the root user - backend can recognise this
export const ROOT_UID: string = '000000000000000001';

// Username for the root user
export const ROOT_UNAME: string = 'root';

// User ID for the internal PTY
export const INTERNAL_UID = '000000000000000000';

// Username for the internal PTY
export const INTERNAL_UNAME = 'DiscOS-Internal';

// The external backend ping response
export const PING_RESPONSE: string = 'DISCOS';

// Database update dummy command
// External backend endpoint: /dbupdate
export const DB_UPDATE: string = 'dbupdate';

// External backend endpoint: /clear
// Used to clear terminals for not anymore allowed users
export const CLEAR_TERMINALS: string = 'clear';

// External backend endpoint: /init
// Used to initialize terminals for allowed users
export const INIT_TERMINALS: string = 'init';

// External backend error messages
export { EB_DB_ERR, EB_PAYLOAD_INVALID, EB_GENERIC_ERR, EB_DIR_ERR, EB_PERM_ERR, EB_DOWNLOAD_ERR, EB_SET_PERM_ERR } from '../common.js';

// Export exec and terminal management related message functions
export {
  TERMINAL_OUTPUT,
  terminalSpawnedMessage,
  terminalRespawnMessage,
  terminalSpawnFailedMessage,
  terminalDestroyedMessage,
  terminalSyncCompleteMessage,
} from '../common.js';
