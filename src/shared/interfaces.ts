export interface ICommandQueueItem {
  // Discord user ID
  user: string;

  // Guild-specific username
  // Only matters when show as part of a response to a user commands (only cosmetic)
  // Internal commands and many admin ones have this assigned as 'root' or '', but is not important
  username: string;

  // Command to execute
  cmd: string;
}

export interface IPCResponse {
  // Response flag
  valid: boolean;
}

export interface IFileWritePayload {
  // File URL (Discord CDN)
  url: string;

  // Destination path on server
  path: string;

  // Command queue item
  payload: ICommandQueueItem;
}
