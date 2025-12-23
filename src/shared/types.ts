export type DB = {
  // Mapping of UIDs to their corresponding local usernames
  users: Record<string, string>;

  // List of admin UIDs
  adminUsers: string[];

  // List of allowed channel IDs
  allowedChannels: string[];

  // Toggle standalone or external backend mode
  standalone: boolean;

  // Toogle safemode (command validation)
  safemode: boolean;

  // Toggle lockdown mode (only admins can use the bot)
  lockdown: boolean;
};
