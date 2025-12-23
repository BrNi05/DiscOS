import type { Server } from 'node:net';

export const Config: {
  cmdQueueMaxSize: number;
  backend: string;
  databasePath: string;
  fileMaxSize: number;
  readBinOverride: string[];
  quickView: string[];
  quickViewMaxLength: number;
  allowedUsers: string[];
  adminUsers: string[];
  allowedChannels: string[];
  ipcServer: null | Server; // startIPCServer() instance
  standalone: boolean;
  safemode: boolean;
  lockdown: boolean;
  userRateLimit: number;
} = {
  cmdQueueMaxSize: 0,
  backend: '',
  databasePath: '',
  fileMaxSize: 0,
  readBinOverride: [],
  quickView: [],
  quickViewMaxLength: 2000,
  allowedUsers: [],
  adminUsers: [],
  allowedChannels: [],
  ipcServer: null,
  standalone: false,
  safemode: false,
  lockdown: false,
  userRateLimit: 0,
};
