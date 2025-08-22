export interface ICommandQueueItem {
  user: string;
  cmd: string;
}

export interface IPCResponse {
  valid: boolean;
}

export interface IFileWritePayload {
  url: string;
  path: string;
  payload: ICommandQueueItem;
}
