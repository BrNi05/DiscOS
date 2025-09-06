export type DB = {
  users: Record<string, string>;
  adminUsers: string[];
  allowedChannels: string[];
  standalone: boolean;
  safemode: boolean;
  lockdown: boolean;
};
