// IPC server socket path
export const SOCKET_PATH: string = '/tmp/discos.sock';

// User ID for the root user - backend can recognise this
export const ROOT_UID: string = '111111111111111111';

// The external backend ping response
export const PING_RESPONSE: string = 'DISCOS';

// Database update dummy command
// The suffix added to the backend URL when updating the database
export const DB_UPDATE: string = 'dbupdate';
