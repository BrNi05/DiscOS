// IPC server socket path
export const SOCKET_PATH: string = '/tmp/discos.sock';

// User ID for the root user - backend can recognise this
export const ROOT_UID: string = '111111111111111111';

// Username for the root user
export const ROOT_UNAME: string = 'root';

// The external backend ping response
export const PING_RESPONSE: string = 'DISCOS';

// Database update dummy command
// The suffix added to the backend URL when updating the database
export const DB_UPDATE: string = 'dbupdate';

// External backend error messages
export { EB_DB_ERR, EB_PAYLOAD_INVALID, EB_GENERIC_ERR, EB_DIR_ERR, EB_PERM_ERR, EB_DOWNLOAD_ERR, EB_SET_PERM_ERR } from '../common.js';
