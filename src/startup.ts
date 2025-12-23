import { Client, GatewayIntentBits, Events, type Attachment } from 'discord.js';

// Helpers
import { validateDotenv } from './config/validateDotenv.js';
import { validateDb } from './config/validateDb.js';
import { Config } from './config/config.js';
import { startIPCServer } from './security/ipcServer.js';
import * as queueUtils from './security/queue-utils.js';
import { ping } from './exec/backend.js';
import { discordUsername } from './exec/username.js';
import { destroyTerminalForUser, initTerminalsFromConfig } from './exec/terminal-manager.js';
import logger from './logging/logger.js';

// Consts and project-scoped types
import * as COMMON from './common.js';
import type { ICommandQueueItem } from './shared/interfaces.js';
import type { CommandQueues } from './interfaces/queues.js';

// Modules
import { registerSlashCommands } from './slash-commands.js';
import { execCommand } from './modules/command.js';
import { clearHistory } from './modules/clear.js';
import { read, write, absPath, pathAutocomplete, cwdPath } from './modules/file.js';
import { watch } from './modules/watch.js';
import { debug } from './modules/debug.js';
import { handleAdmin, localUserAutocomplete } from './modules/admin.js';

import { fileURLToPath } from 'node:url';
import dns from 'node:dns';

// DNS settings for Discord connection stability
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);

// Start DiscOS function
export async function startDiscOS(): Promise<void> {
  // Platform validation
  if (process.platform !== 'linux') {
    logger.error(COMMON.PLATFORM_ERR);
    process.exit(1);
  }

  // Load and validate environment variables
  if (!validateDotenv()) {
    process.exit(1);
  }

  // Command queue
  const queues: CommandQueues = {
    // Validation queue is "faster" - items are removed on validation
    validationQueue: [],

    // Duplicate queue is "slower" - items are removed after processing
    duplicateQueue: [],
  };

  // Validate database and load additional environment variables
  if (!validateDb(queues)) process.exit(1);

  // Load DB content to Terminal Manager
  // The EB should init itself on startup
  if (Config.standalone) await initTerminalsFromConfig(queues);

  // Warn user if the PTY test mode is enabled
  if (process.env.PTY_TEST_MODE) logger.warn(COMMON.PTY_TEST_MODE_WARN);

  // IPC server init (if not in standalone mode)
  // In unsafe mode, the IPC server is still active, but always returns validated status
  // The backend is not required to use the IPC server at all, yet it is recommended for security reasons
  Config.ipcServer = Config.standalone ? null : startIPCServer(queues);

  // Set DiscOS intents
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  // Ping external backend (if not in standalone mode)
  if (!Config.standalone) void ping();

  // Discord event listener (with filtering)
  client.on(Events.InteractionCreate, async (interaction) => {
    // Path autocomplete handler
    if (interaction.isAutocomplete()) {
      const subcommand: string = interaction.options.getSubcommand();
      if (interaction.commandName === COMMON.DCOS && (subcommand === COMMON.READ || subcommand === COMMON.WRITE)) {
        return pathAutocomplete(interaction, queues);
      } else if ((interaction.commandName === COMMON.DCOS || interaction.commandName === COMMON.ADMOS) && subcommand === COMMON.USER_MGMT) {
        return localUserAutocomplete(interaction, queues);
      }
    }

    // Only respond to chat input and specific commands
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== COMMON.DCOS && interaction.commandName !== COMMON.ADMOS) return;

    // Only allow messages in guilds (servers)
    if (!interaction.guild) {
      await interaction.reply({ content: COMMON.GUILD_ERR, flags: 64 });
      return;
    }

    // Only allow specific channels
    if (!Config.allowedChannels.includes(interaction.channelId)) {
      await interaction.reply({ content: COMMON.CHANNEL_ERR, flags: 64 });
      return;
    }

    // Only allow specific users to use DiscOS
    if (!Config.allowedUsers.includes(interaction.user.id)) {
      await interaction.reply({ content: COMMON.USER_ERR, flags: 64 });
      return;
    }

    // Process the command and context
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username = discordUsername(interaction);

    // Enforce lockdown mode
    const isAdminUser: boolean = Config.adminUsers.includes(userId);
    if (Config.lockdown && !isAdminUser) {
      await interaction.reply({ content: COMMON.LOCKDOWN_ERR, flags: 64 });
      return;
    }

    // Handle admin commands
    if (interaction.commandName === COMMON.ADMOS) {
      if (!isAdminUser) {
        await interaction.reply({ content: COMMON.DISCOS_NON_ADMIN, flags: 64 });
        return;
      }
      await handleAdmin(interaction, subcommand, username, queues, client);
      return;
    }

    // User-scoped rate limiting
    if (queueUtils.countUserCommandsInQueue(queues.duplicateQueue, interaction.user.id) >= Config.userRateLimit) {
      await interaction.reply({ content: COMMON.USER_RATE_LIMIT, flags: 64 });
      return;
    }

    // Global rate-limiting
    if (queues.duplicateQueue.length >= Number(Config.cmdQueueMaxSize)) {
      await interaction.reply({ content: COMMON.DISCOS_OVERLOADED, flags: 64 });
      return;
    }

    // Determine the subcommand and process it
    // All subcommands are translated into pseudo-command, and stored in that form in the queue, thus preventing spoofing
    let queuedCmd: string = ''; // the format used for queuing and user-scoped concurrency restrictions
    const hideReply: boolean = interaction.options.getBoolean(COMMON.HIDE, false) ?? COMMON.DEFAULT_HIDDEN;

    let lookback: number = COMMON.DEFAULT_LOOKBACK; // may not be used
    let path: string = ''; // may not be used
    let file = null as unknown as Attachment; // may not be used
    let interval: number = COMMON.DEFAULT_INTERVAL; // may not be used
    let repeat: number = COMMON.DEFAULT_REPEAT; // may not be used
    let sendSuccessMsg: boolean = COMMON.DEFAULT_DEBUG_VERBOSE; // may not be used

    switch (subcommand) {
      case COMMON.EXEC: {
        const linuxCmd = interaction.options.getString(COMMON.CMD, false)?.trim() || ''; // Can be empty since v1.2
        queuedCmd = linuxCmd;
        break;
      }
      case COMMON.CLEAR: {
        lookback = interaction.options.getInteger(COMMON.LOOKBACK, false) ?? lookback;
        sendSuccessMsg = interaction.options.getBoolean(COMMON.VERBOSE, false) ?? sendSuccessMsg;
        queuedCmd = `dcos clear ${userId}`; // ignore lookback here, so two clear processes cannot run concurrently for the same user
        break;
      }
      case COMMON.READ: {
        path = interaction.options.getString(COMMON.PATH, true);
        queuedCmd = `cat ${path} | base64`;
        break;
      }
      case COMMON.WRITE: {
        file = interaction.options.getAttachment(COMMON.FILE, true);
        path = await absPath(
          file.name,
          interaction.options.getString(COMMON.PATH, false) ?? (await cwdPath(file.name, userId, queues)),
          userId,
          queues
        ); // left empty, use the uploaded file's name in CWD
        queuedCmd = `dcos write to ${path}`;
        break;
      }
      case COMMON.WATCH: {
        path = interaction.options.getString(COMMON.TARGET, true);
        interval = interaction.options.getInteger(COMMON.INTERVAL, false) ?? interval;
        repeat = interaction.options.getInteger(COMMON.REPEAT, false) ?? repeat;
        queuedCmd = `dcos watch ${userId}`;
        break;
      }
      case COMMON.DEBUG: {
        queuedCmd = 'dcos debug'; // Just dummy register the command
        break;
      }
      case COMMON.RESET: {
        queuedCmd = 'dcos reset'; // Just dummy register the command
        break;
      }
      case COMMON.HELP: {
        queuedCmd = 'dcos help'; // Just dummy register the command
        break;
      }
    }

    // Avoid duplicates
    const payload: ICommandQueueItem = { user: userId, username: discordUsername(interaction), cmd: queuedCmd };
    if (await queueUtils.handleDuplicate(interaction, username, queues.duplicateQueue, payload)) return;

    // Avoid Discord timeouts
    await interaction.deferReply({ flags: hideReply ? 64 : undefined });

    // Register the command as validated
    queueUtils.addToAll(queues, payload);

    // Handle the commands
    try {
      switch (subcommand) {
        case COMMON.EXEC: {
          await execCommand(payload, interaction, queuedCmd, username, 0, queues);
          break;
        }
        case COMMON.CLEAR: {
          await clearHistory(lookback, interaction, username, sendSuccessMsg);
          break;
        }
        case COMMON.READ: {
          await read(interaction, username, path, payload);
          break;
        }
        case COMMON.WRITE: {
          await write(interaction, username, file, path, payload, queues);
          break;
        }
        case COMMON.WATCH: {
          await watch(interaction, username, userId, path, interval, repeat, queues);
          break;
        }
        case COMMON.DEBUG: {
          await debug(interaction, username, userId, queues, client);
          break;
        }
        case COMMON.RESET: {
          destroyTerminalForUser(interaction.user.id);
          await interaction.editReply({ content: COMMON.PTY_RESET_SUCCESS });
          break;
        }
        case COMMON.HELP: {
          await interaction.editReply({ content: COMMON.HELP_USER });
          break;
        }
      }
    } catch {
      await interaction.editReply({ content: COMMON.DISCOS_GENERIC_ERR2 + username + '.' });
    } finally {
      // Make sure processed commands are removed from both queues
      queueUtils.removeFromAll(queues, payload);
    }
  });

  // Connect to Discord servers
  void client.login(process.env.BOT_TOKEN).catch((err) => {
    logger.error(COMMON.DISCOS_CONN_FAIL, err);
    process.exit(1);
  });

  // Error handling for Discord.js client
  // Mostly triggered by rate limiting
  client.on(Events.Error, (err) => {
    logger.error(COMMON.DISCOS_CLIENT_ERR, err);
  });
}

// Auto-start DiscOS if it's executed directly with Node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  registerSlashCommands();
  startDiscOS().catch(() => {
    logger.error(COMMON.DISCOS_STARTUP_ERR);
    process.exit(1);
  });
}
