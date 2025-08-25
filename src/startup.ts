import type { Attachment } from 'discord.js';
import { Client, GatewayIntentBits, Events } from 'discord.js';

// Helpers
import { validateDotenv } from './tools/validateDotenv';
import { validateDb } from './tools/validateDb';
import { startIPCServer } from './tools/ipcServer';
import * as queueUtils from './tools/queue-utils';

// Database config file
import { Config } from './config';

// Consts and project-scoped types
import * as COMMON from './common';

// Repo scoped types
import type { ICommandQueueItem } from './shared/interfaces';

// Modules
import { registerSlashCommands } from './slash-commands';
import { execCommand } from './modules/command';
import { clearHistory } from './modules/clear';
import { read, write } from './modules/file';
import { watch } from './modules/watch';
import { debug } from './modules/debug';
import { handleAdmin } from './modules/admin';

// Start DiscOS func
export function startDiscOS(): void {
  // Load and validate environment variables
  if (!validateDotenv()) {
    process.exit(1);
  }

  // Validate database and load additional environment variables
  if (!validateDb()) {
    process.exit(1);
  }

  // Command queue
  const commandQueue: ICommandQueueItem[] = [];

  // IPC server init (if not in standalone mode)
  // In unsafe mode, the IPC server is still active, but always returns validated status
  // The backend is not required to use the IPC server at all, yet it is recommended for security reasons
  Config.ipcServer = Config.standalone ? null : startIPCServer(commandQueue);

  // Set DiscOS intents
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  // Discord event listener (with filtering)
  client.on(Events.InteractionCreate, async (interaction) => {
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

    // Rate-limiting
    if (commandQueue.length >= Number(Config.cmdQueueMaxSize)) {
      await interaction.reply({ content: COMMON.DISCOS_OVERLOADED, flags: 64 });
      return;
    }

    // Process the command and context
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username =
      interaction.member && 'nickname' in interaction.member
        ? (interaction.member.nickname ?? interaction.user.username)
        : (interaction.user.displayName ?? interaction.user.username);

    // Enforce lockdown mode
    const isAdminUser: boolean = Config.adminUsers.includes(userId);
    if (Config.lockdown && !isAdminUser) {
      await interaction.reply({ content: COMMON.LOCKDOWN_ERR, flags: 64 });
      return;
    }

    // Handle admin commands
    if (interaction.commandName === COMMON.ADMOS) {
      if (!isAdminUser) {
        await interaction.reply({
          content: COMMON.DISCOS_NON_ADMIN,
        });
        return;
      }
      await handleAdmin(interaction, subcommand, username, commandQueue);
      return;
    }

    // Determine the subcommand and process it
    // All subcommands are translated into pseudo-command, and stored in that form in the queue, thus preventing spoofing
    let queuedCmd: string = ''; // the format used for queuing and concurrency restrictions
    const hideReply: boolean = interaction.options.getBoolean(COMMON.HIDE, false) ?? COMMON.DEFAULT_HIDDEN;

    let lookback: number = COMMON.DEFAULT_LOOKBACK; // may not be used
    let path: string = ''; // may not be used
    let file = null as unknown as Attachment; // may not be used
    let interval: number = COMMON.DEFAULT_INTERVAL; // may not be used
    let repeat: number = COMMON.DEFAULT_REPEAT; // may not be used
    let sendSuccessMsg: boolean = COMMON.DEFAULT_DEBUG_VERBOSE; // may not be used

    switch (subcommand) {
      case COMMON.EXEC: {
        const linuxCmd = interaction.options.getString(COMMON.CMD, true)?.trim() || COMMON.FALLBACK_CMD;
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
        path = interaction.options.getString(COMMON.PATH, false) ?? file.name; // left empty, use the uploaded file's name in CWD
        queuedCmd = `dcos write to ${path}`; // This does not necessarily prevent multiple users concurrently writing the same file
        break;
      }
      case COMMON.WATCH: {
        path = interaction.options.getString(COMMON.TARGET, true);
        interval = interaction.options.getInteger(COMMON.INTERVAL, false) ?? interval;
        repeat = interaction.options.getInteger(COMMON.REPEAT, false) ?? repeat;
        queuedCmd = `dcos watch ${path} ${userId}`;
        break;
      }
      case COMMON.DEBUG: {
        queuedCmd = `dcos debug`; // Just dummy register the command
        break;
      }
    }

    // Avoid duplicates
    if (await queueUtils.handleDuplicate(interaction, username, commandQueue, { user: userId, cmd: queuedCmd })) {
      return;
    }

    // Avoid Discord timeouts
    await interaction.deferReply({ flags: hideReply ? 64 : undefined });

    // Register the command as validated
    const payload: ICommandQueueItem = { user: userId, cmd: queuedCmd };
    commandQueue.push(payload);

    // Handle the commands
    try {
      switch (subcommand) {
        case COMMON.EXEC: {
          await execCommand(payload, interaction, queuedCmd, username, 0, commandQueue);
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
          await write(interaction, username, file, path, payload, commandQueue);
          break;
        }
        case COMMON.WATCH: {
          await watch(interaction, username, userId, path, interval, repeat, commandQueue);
          break;
        }
        case COMMON.DEBUG: {
          await debug(interaction, username, userId, commandQueue, client);
          break;
        }
      }
    } catch {
      await interaction.editReply({ content: COMMON.DISCOS_GENERIC_ERR2 + username + '.' });
    } finally {
      queueUtils.tryRemoveInQueue(commandQueue, payload); // removes payload if backend does not use IPCServer (which removes the payload from queue automatically)
    }
  });

  // Connect to Discord servers
  void client.login(process.env.BOT_TOKEN).catch((err) => {
    console.error(COMMON.DISCOS_CONN_FAIL, err);
    process.exit(1);
  });
}

// Auto-start DiscOS if it is run directly with Node
if (require.main === module) {
  registerSlashCommands();
  startDiscOS();
}
