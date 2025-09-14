// Platform validation
export const PLATFORM_ERR = 'DiscOS CRITICAL ERROR: Only Linux is supported. Startup aborted.';

// dotenv validation
export function ENV_MISSING_VAR(missingVars: string[]): string {
  return `DiscOS ERROR: Missing environment variables: ${missingVars.join(', ')}`;
}
export const ENV_TOKEN = 'DiscOS ERROR: BOT_TOKEN must be at least 59 characters long.';
export const ENV_APPID = 'DiscOS ERROR: APP_ID must be a numeric string with at least 17 characters.';
export const ENV_GUILDS = 'DiscOS ERROR: GUILD_IDS must be comma-separated numeric strings with at least 17 characters.';
export const ENV_VER = 'DiscOS ERROR: VERSION must be a non-empty string in format x.y.z (e.g., 1.0.0).';
export const ENV_QUEUE_MAX = 'DiscOS ERROR: CMD_QUEUE_MAX_SIZE must be a positive integer.';
export const ENV_BACKEND = 'DiscOS ERROR: BACKEND must be a non-empty string.';
export const ENV_FILE_MAX = 'DiscOS ERROR: FILE_MAX_SIZE must be a positive integer less than or equal to 1000.';
export const ENV_BIN_OVERRIDE = 'DiscOS ERROR: READ_BIN_OVERRIDE must be a non-empty comma-separated list of binaries.';
export const ENV_QUICK_VIEW =
  "DiscOS ERROR: QUICK_VIEW must be a non-empty comma-separated list of file extensions. '?' as extension is not allowed.";
export const ENV_QUICK_VIEW_MAX_LENGTH = 'DiscOS ERROR: QUICK_VIEW_MAX_LENGTH must be a positive integer between 0 and 2000.';

// DB validation
export const DB_ERR = 'DiscOS ERROR: Database file is invalid or missing.';
export const DB_USER_ERR = 'DiscOS ERROR: users must be an object with numeric string keys (Discord UIDs) and string values (local users).';
export const DB_USERS_EMPTY = 'DiscOS WARN: No users found in database.';
export const DB_USERS_INVALID = 'User IDs must be numeric strings at least 17 characters long.';
export const DB_ADMIN_ERR = 'DiscOS ERROR: adminUsers must be an array of numeric strings with at least 17 characters.';
export const DB_NO_ADMIN = 'DiscOS ERROR: There must be at least one admin user in the database.';
export const DB_ADMIN_INVALID = 'DiscOS ERROR: adminUsers must be a non-empty array of numeric strings with at least 17 characters.';
export const DB_ALLOWED_CHANNELS_ARRAY = 'DiscOS ERROR: allowedChannels must be a non-empty array.';
export const DB_ALLOWED_CH_EMPTY = 'DiscOS WARN: No allowed channels found in database.';
export const DB_ALLOWED_CH_INVALID = 'DiscOS ERROR: allowedChannels must contain numeric strings with at least 17 characters.';
export const DB_BOOLEAN_ERR = 'DiscOS ERROR: Database boolean fields must be true or false.';

// Command registration - USER
export const CMD_REG_1 = 'Slash commands registered on guild (server):';
export const CMD_REG_2 = 'Failed to register slash commands on guild (server):';
export const CMD_REG_ERR = 'Error during slash command registration:';

// Main command
export const DCOS = 'dcos';
export const DCOS_DESC = 'Use DiscOS';

// Subcommand - shared
export const HIDE = 'hide';
export const SUCCESS_VERBOSE = 'Whether to receive a success reply. Default: false.';
export const HIDE_REPLY = 'Hide command reply. Default: true.';
export const VERBOSE = 'verbose';

// Subcommand - exec
export const EXEC = 'exec';
export const EXEC_DESC = 'Execute a Linux command on the server.';
export const CMD = 'cmd';
export const CMD_DESC = 'The Linux command to execute on the server.';

// Subcommand - clear
export const CLEAR = 'clear';
export const CLEAR_DESC = 'Clears the (unhidden) command history.';
export const LOOKBACK = 'lookback';
export const LOOKBACK_DESC = 'How many messages to clear (from newest to oldest). Default: all.';

// Subcommand - read/write
export const READ = 'read';
export const READ_DESC = 'Reads a file from the server and sends it as an attachment.';
export const PATH = 'path';
export const PATH_DESC_READ = 'The path to the file on the server. Should contain the file name (and extension). CWD: ~';
export const WRITE = 'write';
export const WRITE_DESC = 'Uploads any type of file to the server as an attachment.';
export const FILE = 'file';
export const FILE_DESC = 'The file to upload.';
export const PATH_DESC_WRITE = "Destination path on the server. Default: uploaded file's name in CWD (~). Creates or overwrites.";

// Subcommand - watch
export const WATCH = 'watch';
export const WATCH_DESC = 'Periodically executes the given command.';
export const TARGET = 'target';
export const TARGET_DESC = 'The binary to execute.';
export const INTERVAL = 'interval';
export const INTERVAL_DESC = 'Time between two calls in ms. Default: 1000ms (1s). Min: 500ms. Max: 5000ms.';
export const REPEAT = 'repeat';
export const REPEAT_DESC = 'Number of calls to make. Default: 20. Min: 1. Max: 100.';

// Subcommand - debug
export const DEBUG = 'debug';
export const DEBUG_DESC = 'Display various debug infos about the DiscOS instance.';

// Subcommand - help
export const HELP = 'help';
export const HELP_USER_DESC = 'Display help for DiscOS commands.';
export const HELP_ADMIN_DESC = 'Display help for AdmOS (admin) commands.';
export const HELP_USER = '[User commands](https://github.com/BrNi05/DiscOS/wiki/06.-Using-DiscOS-%E2%80%90-user)';
export const HELP_ADMIN =
  '[Admin commands](https://github.com/BrNi05/DiscOS/wiki/07.-Using-DiscOS-%E2%80%90-admin)' +
  '\n' +
  '[User commands](https://github.com/BrNi05/DiscOS/wiki/06.-Using-DiscOS-%E2%80%90-user)';

// Default values for commands
export const DEFAULT_HIDDEN = true;
export const DEFAULT_LOOKBACK = -1; // means unlimited
export const DEFAULT_INTERVAL = 1000; // 1 second
export const DEFAULT_REPEAT = 20; // 20 ticks
export const DEFAULT_DEBUG_VERBOSE = false;
export const FALLBACK_CMD = 'echo "No command entered."';

// Command registration - ADMIN
export const ADMOS = 'admos';
export const ADMOS_DESC = 'DiscOS Admin commands';

// Subcommand - kill
export const KILL = 'kill';
export const KILL_DESC = 'Shuts down the DiscOS instance.';
export const SHUTDOWN_MSG = 'DiscOS instance is shutting down...';

// Subcommand - mode
export const MODE = 'mode';
export const MODE_DESC = "Toggle to use an external backend or use DiscOS's own backend solution.";
export const STANDALONE = 'standalone';
export const STANDALONE_DESC = "True: Use DiscOS's own backend solution. False: Use an external backend.";

// Subcommand - safemode
export const SAFEMODE = 'safemode';
export const SAFEMODE_DESC = 'Applies to standalone mode only. Spoofing protection feature.';
export const CMD_VAL = 'enabled';
export const CMD_VAL_DESC = 'True: Enable command validation. False: Disable command validation.';

// Subcommand - clear
export const ADMIN_CLEAR_DESC = 'Clear the (unhidden) command history for any user/all.';
export const CLEAR_USER = 'user';
export const CLEAR_USER_DESC = "Which user's command history to clear. Default/empty: all.";

// Subcommand - user management
export const USER_MGMT = 'usermgmt';
export const USER_MGMT_DESC = 'Allow/disallow a user to use DiscOS commands.';
export const ADMIN_MGMT = 'adminmgmt';
export const ADMIN_MGMT_DESC = 'Allow/disallow a user to use admin commands.';
export const USER = 'user';
export const OPERATION = 'operation';
export const LOCAL_USER = 'local_user';
export const LOCAL_USER_DESC = 'Select the user account on the server that is to be used by the user.';

// Subcommand - list users
export const LSU = 'lsu';
export const LSU_DESC = 'List all server users and their Discord names.';

// Subcommand - list admin users
export const LSA = 'lsa';
export const LSA_DESC = 'List all admins and their Discord names.';

// Subcommand - channel management
export const CH_MGMT = 'chmgmt';
export const CH_MGMT_DESC = 'Allow/disallow DiscOS to be used on a channel.';
export const CHANNEL = 'channel';
export const CHANNEL_DESC = 'Select the channel that will be affected by the command.';

// Subcommand - lockdown
export const LOCKDOWN = 'lockdown';
export const LOCKDOWN_DESC = 'Turn on lockdown mode (only admin commands can be executed).';
export const ENABLED = 'enabled';
export const LOCKDOWN_ENABLED = 'True: enable. False: disable.';

// Subcommand - root
export const ROOT = 'root';
export const ROOT_DESC = 'Execute a command as root on the server.';

// Subcommand - shared
export const ADDRM = 'True: add. False: remove.';
export const USER_SEL = 'Select the user that will be affected by the command.';

// index.ts
export const GUILD_ERR = 'DiscOS commands can only be used on a server (guild).';
export const CHANNEL_ERR = 'DiscOS commands cannot be used on this channel.';
export const USER_ERR = 'You are currently not allowed to use DiscOS commands.';
export const DISCOS_OVERLOADED = 'DiscOS is overloaded. Try again later...';
export const LOCKDOWN_ERR = 'DiscOS is in lockdown mode. Only admins can use commands.';
export const DISCOS_NON_ADMIN = 'DiscOS ERROR: You are not an admin user. Only admins can use this command.';
export const DUPLICATE_ERR = 'Command (or similar one) is already being processed for user @';
export const DISCOS_GENERIC_ERR = 'DiscOS ERROR:';
export const DISCOS_GENERIC_ERR2 = 'DiscOS encountered an error. User: @';
export const DISCOS_CONN_FAIL = 'Connection to Discord failed:';

// index.ts: IPC Server
export const LISTENING = 'DiscOS IPC server is listening on ';

// Module: command.ts
export function CMD_EXEC_AS_MSG(userCmd: string, username: string): string {
  return `Command: "${userCmd}" executed as @${username}:\n\n`;
}

export function CMD_EXEC_AS_MSG2(username: string): string {
  return `Executing as @${username}:\n`;
}

export const WRITE_CMD = DCOS + ' /' + WRITE;
export const READ_CMD = DCOS + ' /' + READ;
export const WATCH_CMD = DCOS + ' /' + WATCH;

export function RW_USE_DEDICATED(replyPrefix = ''): string {
  return `${replyPrefix}DiscOS ERROR: use <${WRITE_CMD}> or <${READ_CMD}> to perform the action.`;
}

export function WATCH_USE_DEDICATED(replyPrefix = ''): string {
  return `${replyPrefix}DiscOS ERROR: use <${WATCH_CMD}> to perform the action.`;
}

export const BACKEND_EXEC_ERR = 'Error opening terminal: unknown.';
export const BACKEND_EXEC_ERR_OVERRIDE = 'DiscOS ERROR: Interactive terminal commands are not supported.';
export const UNKNOWN_ERR = 'DiscOS ERROR: Execution failed. Unknown error occurred.';

// Module: clear.ts
export const FETCH_ERR = DISCOS_GENERIC_ERR + ' Unable to fetch messages from the channel. User: @';
export const MSG_CLR_FOR = 'Cleared all messages for @';
export const MSG_CLR_PRE = 'Cleared the last ';
export const MSG_CLR_POST = ' messages for ';

// Module: file.ts
export function FILE_CORRUPT_ERR(username: string): string {
  return `DiscOS ERROR: The file is corrupted, too large to send, has unknown extension or unreadable (as @${username}). Check the file path, extension, size and permissions.`;
}

export function FILE_SIZE_ERR(maxSize: number): string {
  return `DiscOS ERROR: Target file is larger than FILE_MAX_SIZE (${maxSize} MB). Requested as @`;
}

export function OS_ERR_MSG(username: string): string {
  return `OS ERROR: File read error as @${username}. Check the file path and permissions.`;
}

export function READ_FILE(path: string, username: string): string {
  return `Read file: ${path} as @${username}.`;
}

export function READ_FILE_QUICK(path: string, username: string): string {
  return `Read file (QuickView): ${path} as @${username}.`;
}

export const READ_FILE_QUICK_LENGTH = 50; // length of constant text

export function WRITE_FILE(path: string, username: string): string {
  return `Wrote file: ${path} as @${username}.`;
}

export function BACKEND_ERR_MSG(username: string, statusCode: number, resString: string): string {
  return `BACKEND ERROR as @${username}.\nHTTP status code: ${statusCode}.\nMessage: ${resString}`;
}

export const NEW_FILE = 'NEW FILE: ';

// Module: watch.ts
export function WATCH_CMD_BUILD(target: string, interval: number, i: number, repeat: number): string {
  return `echo "Watching <${target}> at ${interval}ms intervals. Tick: ${i + 1} / ${repeat}." && echo && ${target}`;
}
export const TOO_MANY_REQ = 'Too many requests. Please try again later...';
export const WATCH_TERM = 'Watch is terminated.';

// Module: admin.ts

export const UNKNOWN_USER = 'Non-server member user';

export function MODE_REPLY(standalone: boolean, pingRes: string): string {
  return `DiscOS is now running in ${standalone ? 'standalone' : 'external backend'} mode.` + '\n' + pingRes;
}

export function SAFEMODE_REPLY(safemode: boolean): string {
  return 'Command validation is now ' + (safemode ? 'enabled' : 'disabled') + '.';
}

export function LOCKDOWN_REPLY(enabled: boolean): string {
  return `Lockdown mode is now ${enabled ? 'enabled' : 'disabled'}.`;
}

export const CLEAR_ALL_USER = '?';
export const CLEAR_ALL_USER_REPLY = 'ALL USERS';

export function AT_LEAST_ONE_ERR(type: string): string {
  return `AdmOS ERROR: At least one ${type} must be in the database.`;
}

export function CH_OPERATION(channelName: string, op: boolean): string {
  const extra = op ? '' : 'not ';
  return `Channel #${channelName} is/was ${extra}allowed to use DiscOS commands.`;
}

export function ADMIN_OPERATION(username: string, op: boolean): string {
  const extra = op ? '' : 'not ';
  return `User @${username} is/was ${extra}allowed to use admin commands.`;
}

export function ADMIN_OPS(username: string, localUser: string, op: boolean, overr: boolean, userDelete: boolean): string {
  const extra = op ? 'added' : 'removed';
  const override = overr ? '\nPrevious local user setting was overwritten.' : '';
  const deleteMsg = userDelete ? '\nA local user was removed as well.' : '';
  return `User @${username} (as ${localUser} on server) is/was ${extra} as a DiscOS user.` + override + deleteMsg;
}

export function NOT_IN_USERLIST_ERR(user: string): string {
  return `AdmOS ERROR: @${user} is not a DiscOS user.\nUse the /admos usermgmt slash command, which can (while registering the user) add an admin user.`;
}

export const ADMIN = 'admin';

export const PROPAGATE = 'propagate';
export const PROPAGATE_DESC = 'True: create / remove local user based on DiscOS operation. Default: true.';
export const DEFAULT_PROPAGATE = true;

export function COULDNT_PROPAGATE_ERR(localUser: string): string {
  return `AdmOS ERROR: Local user "${localUser}" is non-existent and propagation is turned off. Operation aborted.`;
}

export const ADMIN_AS_WELL = 'admin';
export const ADMIN_AS_WELL_DESC = 'True: register the select user as admin as well. Default: false.';
export const DEFAULT_ADMIN_AS_WELL = false;

export const NEW_USER = 'NEW USER: ';

export function USER_GREETING(user: string, localUser: string, guild: string): string {
  return `Hello @${user},\n\nYou have been registered to use DiscOS commands (as ${localUser}) on Discord server: ${guild}.\nUse /${DCOS} ${HELP} to see available commands.`;
}

export function USER_GOODBYE(user: string): string {
  return `Goodbye @${user},\n\nYour DiscOS user has been removed and you can no longer use DiscOS commands.\nIf this was a mistake, please contact an admin.`;
}

export function ADMIN_GREETING(user: string, localUser: string, guild: string): string {
  return `Hello @${user},\n\nYou have been registered as a DiscOS admin on Discord server: ${guild}. Now you can use AdmOS commands.\nYou are also registered to use DiscOS commands on the host as: ${localUser}.\nUse /${DCOS} ${HELP} to see available user commands and /${ADMOS} ${HELP} to see available admin commands.`;
}

export function ADMIN_GOODBYE(user: string): string {
  return `Hello @${user},\n\nYour DiscOS admin rights have been revoked and you can no longer use AdmOS commands.\nIf this was a mistake, please contact an admin.`;
}

export const UNAME_PREFIX = 'discos';

// Backend
export const SPAWN_ERR = 'DiscOS CRITICAL ERROR: cmdex is broken.';
export const DIR_ERR = 'The provided path is an existing directory.';
export const PERM_ERR = 'No permission to write to the file (or to enter the directories).';
export const DOWNLOAD_ERR = 'Failed to download file from Discord CDN.';
export const SET_PERM_ERR = 'Failed to set file permissions.';

export const PING_FAILED = 'Ping failed: ';
export const EXTERNAL_OK = 'External backend is online and responded to the health check ping.';
export const EXTERNAL_NORESPONSE =
  'WARNING! The external backend did not respond to the health check ping. It may be offline or unreachable.';

export const NETWORK_ERR = 'DiscOS ERROR: Network error while trying to connect to the backend.';
