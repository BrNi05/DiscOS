import type { ChatInputCommandInteraction, AutocompleteInteraction, CacheType, Guild, Client } from 'discord.js';

// Modules
import { execCommand } from './command.js';
import { startIPCServer } from '../security/ipcServer.js';
import { clearHistory } from './clear.js';

// Helpers
import * as queueUtils from '../security/queue-utils.js';
import { ping, post } from '../exec/backend.js';
import { destroyTerminalForUser, syncTerminalsWithConfig } from '../exec/terminal-manager.js';
import logger from '../logging/logger.js';
import shellEscape from 'shell-escape';

// Consts and interfaces
import * as COMMON from '../common.js';
import type { ICommandQueueItem } from '../shared/interfaces.js';
import type { CommandQueues } from '../interfaces/queues.js';
import { ROOT_UID, INTERNAL_UID, INTERNAL_UNAME, ROOT_UNAME } from '../shared/consts.js';

// Config file
import { Config } from '../config/config.js';

// DB-related
import fs from 'node:fs';
import type { DB } from '../shared/types.js';
import { validateDb } from '../config/validateDb.js';
import { discordUsername } from '../exec/username.js';

// User listing helper
async function listUsers(interaction: ChatInputCommandInteraction<CacheType>, guild: Guild, group: string[]): Promise<void> {
  // Cache all the guild users
  await guild.members.fetch();

  // Fetch all members by their UIDs and prep the list
  const userList = group.map((userId) => {
    const member = guild.members.cache.get(userId);
    const displayName = member?.nickname ?? member?.user.username ?? '';
    return member ? `@${displayName} (${userId})` : `${COMMON.UNKNOWN_USER} (${userId})`;
  });

  await interaction.editReply({ content: '```plaintext\n' + userList.join('\n') + '\n```' });
}

// Database Helpers
async function dbPrep(interaction: ChatInputCommandInteraction<CacheType>): Promise<false | DB> {
  try {
    const rawData = fs.readFileSync(Config.databasePath, 'utf-8');
    const db = JSON.parse(rawData) as DB;

    if (typeof db !== 'object' || db === null) throw new Error('Database could not be read or parsed.');
    return db;
  } catch {
    await interaction.editReply({
      content: COMMON.DB_ERR,
    });

    return false;
  }
}

function dbClose(db: DB, queues: CommandQueues) {
  fs.writeFileSync(Config.databasePath, JSON.stringify(db, null, 2), 'utf-8');
  validateDb(queues); // load new db to Config
}

// Local user auto-complete helper
export async function localUserAutocomplete(interaction: AutocompleteInteraction<CacheType>, queues: CommandQueues): Promise<void> {
  // Do not respond in certain situations
  if (!interaction.guild || !Config.allowedChannels.includes(interaction.channelId) || !Config.allowedUsers.includes(interaction.user.id)) {
    return;
  }

  // The current user input string
  const focusedValue = interaction.options.getFocused();

  // Find suggestions
  const payload: ICommandQueueItem = {
    user: INTERNAL_UID,
    username: INTERNAL_UNAME,
    cmd: `grep -vE ':(/usr/sbin/nologin|/bin/false|/sbin/nologin)$' /etc/passwd | cut -d: -f1 | grep -F -- "${shellEscape([focusedValue])}" | head -n 5`,
  };

  queueUtils.addToAll(queues, payload);
  const res = await post(payload, false, true);
  queueUtils.removeFromAll(queues, payload);

  const items: string[] = (res.data as Buffer)
    .toString('utf-8')
    .split('\n')
    .filter((item) => item.trim() !== '');

  // Items array shouldn't be empty (causes Discod API error and app crash)
  if (items.length === 0) {
    items.push(focusedValue);
  }

  // Map the suggestions to the format required by Discord.js
  const prefix = String(res.data).trim().length === 0 ? COMMON.NEW_USER : '';

  await interaction.respond(
    items.map((choice) => ({
      name: prefix + choice,
      value: choice,
    }))
  );
}

// DM helper
async function sendDM(client: Client, userId: string, content: string): Promise<void> {
  const user = await client.users.fetch(userId);

  void user.send(content); // silently fail on DM errors (eg. a user only allows DMs from friends)
}

// Checks if the localUser exists on the host, creates it if requested, or deletes it if requested
const LOCAL_USER_FAILED = 'false';
const LOCAL_USER_SUCCESS = 'true';

async function localUserHandler(localUser: string, propagate: boolean, operation: boolean, queue: CommandQueues): Promise<string> {
  if (operation) {
    // Check if the local user exists
    const payload: ICommandQueueItem = {
      user: INTERNAL_UID,
      username: INTERNAL_UNAME,
      cmd: `id -u ${shellEscape([localUser])}`,
    };

    queueUtils.addToAll(queue, payload);
    const res = await post(payload, false, true);
    queueUtils.removeFromAll(queue, payload);

    let userExists = true;
    if ((res.data as Buffer).toString('utf-8').trim().startsWith('id: ')) {
      userExists = false;
    }

    if (propagate) {
      if (!userExists) {
        const payload: ICommandQueueItem = {
          user: INTERNAL_UID,
          username: INTERNAL_UNAME,
          cmd: `useradd -m ${shellEscape([localUser])}`,
        };

        queueUtils.addToAll(queue, payload);
        await post(payload, false, true);
        queueUtils.removeFromAll(queue, payload);

        return LOCAL_USER_SUCCESS;
      }
    } else if (!userExists) {
      return LOCAL_USER_FAILED;
    }
  } else {
    // It is checked on call, if only this user is assigned this local user
    if (propagate) {
      const payload: ICommandQueueItem = {
        user: INTERNAL_UID,
        username: INTERNAL_UNAME,
        cmd: `id -u ${shellEscape([localUser])} >/dev/null 2>&1 && userdel -r ${shellEscape([localUser])} >/dev/null 2>&1`,
      };

      queueUtils.addToAll(queue, payload);
      void post(payload, false, true);
      queueUtils.removeFromAll(queue, payload);
    }

    return LOCAL_USER_SUCCESS;
  }

  return LOCAL_USER_SUCCESS;
}

// Username trunctuate tool
function truncUname(input: string): string {
  const MAX_LEN: number = 32;

  input = input.toLowerCase().trim();

  // Sanitize the username
  input = input.replaceAll(/[^a-z0-9_.]/g, '');

  if (input.length > MAX_LEN) {
    return input.substring(0, MAX_LEN);
  }

  return input;
}

// Orchestration
export async function handleAdmin(
  interaction: ChatInputCommandInteraction<CacheType>,
  subcommand: string,
  username: string,
  queues: CommandQueues,
  client: Client
): Promise<void> {
  // Defer reply, just to be sure (always hidden)
  await interaction.deferReply({ flags: 64 });

  // Precompute some values
  const guild = interaction.guild!;

  // Handle subcommands
  switch (subcommand) {
    case COMMON.KILL: {
      await kill(interaction);
      break;
    }
    case COMMON.MODE: {
      await mode(interaction);
      break;
    }
    case COMMON.SAFEMODE: {
      await safemode(interaction);
      break;
    }
    case COMMON.CLEAR: {
      const userObj = interaction.options.getUser(COMMON.CLEAR_USER, false);
      const member = userObj ? interaction.guild?.members.resolve(userObj) : null;
      const targetUser: string = member ? (member.nickname ?? member.user.username) : COMMON.CLEAR_ALL_USER;

      const lookback: number = interaction.options.getInteger(COMMON.LOOKBACK, false) ?? COMMON.DEFAULT_LOOKBACK;
      const sendSuccessMsg: boolean = interaction.options.getBoolean(COMMON.VERBOSE, false) ?? COMMON.DEFAULT_DEBUG_VERBOSE;
      await clearHistory(lookback, interaction, targetUser, sendSuccessMsg);
      break;
    }
    case COMMON.USER_MGMT: {
      await userMgmt(interaction, client);
      break;
    }
    case COMMON.LSU: {
      await listUsers(interaction, guild, Config.allowedUsers);
      break;
    }
    case COMMON.ADMIN_MGMT: {
      await adminMgmt(interaction, client);
      break;
    }
    case COMMON.LSA: {
      await listUsers(interaction, guild, Config.adminUsers);
      break;
    }
    case COMMON.CH_MGMT: {
      await chMgmt(interaction);
      break;
    }
    case COMMON.LOCKDOWN: {
      await lockdown(interaction);
      break;
    }
    case COMMON.ROOT: {
      await rootCommand(interaction);
      break;
    }
    case COMMON.RESET: {
      destroyTerminalForUser(ROOT_UID);
      await interaction.editReply({ content: COMMON.PTY_RESET_SUCCESS });
      break;
    }
    case COMMON.HELP: {
      await interaction.editReply({ content: COMMON.HELP_ADMIN });
      break;
    }
  }

  // /admos kill
  async function kill(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    logger.info(COMMON.ADMIN_KILL_LOG(discordUsername(interaction)));

    await interaction.editReply({
      content: COMMON.SHUTDOWN_MSG,
    });

    process.exit(0);
  }

  // /admos mode <standalone?>
  async function mode(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const standalone = interaction.options.getBoolean(COMMON.STANDALONE, true);

    // Switch indicator
    // If a switch happens, then the terminals need to be respawned on the EB or this instance and destroyed on the other
    let switchHappened = false;

    // Ping function
    // Only ping if switching to external backend mode (will raise a PTY clear flag on the EB)
    let pingRes = '';

    // Start/stop IPC server
    if (Config.standalone && !standalone) {
      Config.ipcServer = startIPCServer(queues); // switch to backend mode
      logger.info(COMMON.MODE_SWITCH_LOG(discordUsername(interaction), 'backend'));
      pingRes = await ping();
      switchHappened = true;
    } else if (!Config.standalone && standalone) {
      Config.ipcServer!.close(); // switch to standalone mode
      logger.info(COMMON.MODE_SWITCH_LOG(discordUsername(interaction), 'standalone'));
      Config.ipcServer = null;
      switchHappened = true;
    }

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.standalone = standalone; // write to DB, then load it to Config
    dbClose(db, queues); // if EB is turned on, this will refresh the DB on the EB

    await interaction.editReply({
      content: COMMON.MODE_REPLY(standalone, pingRes),
    });

    // Process switch
    if (switchHappened) await syncTerminalsWithConfig(true, queues);
  }

  // /admos safemode <true?>
  async function safemode(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const enabled = interaction.options.getBoolean(COMMON.CMD_VAL, true);

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.safemode = enabled; // write to DB, then load it to Config
    dbClose(db, queues);

    logger.info(COMMON.SAFEMODE_SWITCHED_LOG(discordUsername(interaction), enabled));

    await interaction.editReply({
      content: COMMON.SAFEMODE_REPLY(enabled),
    });
  }

  // /admos usermgmt <user> <localProfile> <add?/remove?>
  async function userMgmt(interaction: ChatInputCommandInteraction<CacheType>, client: Client): Promise<void> {
    const userObj = interaction.options.getUser(COMMON.USER, true);
    const guildName = interaction.guild!.name;
    const targetUser: string = userObj.username;
    const userId = userObj.id;
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);
    let localUser = interaction.options.getString(COMMON.LOCAL_USER, false)?.trim() ?? userObj.username; // optional field: use the Discord name if not provided
    const propagate = interaction.options.getBoolean(COMMON.PROPAGATE, false) ?? COMMON.DEFAULT_PROPAGATE;
    const adminAsWell = interaction.options.getBoolean(COMMON.ADMIN_AS_WELL, false) ?? COMMON.DEFAULT_ADMIN_AS_WELL;

    logger.info(COMMON.USERMGMT_LOG(discordUsername(interaction), operation, targetUser, localUser, propagate, adminAsWell));

    let deleteUser = false; // only used on user removal

    const db: false | DB = await dbPrep(interaction);
    if (!db) return;

    if (operation) {
      // Transform localUser to a valid Linux username
      if (!interaction.options.getString(COMMON.LOCAL_USER, false)?.trim()) localUser = truncUname(COMMON.UNAME_PREFIX + '_' + targetUser);

      // Check localUser
      const res: string = await localUserHandler(localUser, propagate, operation, queues);
      if (res === LOCAL_USER_FAILED) {
        await interaction.editReply({
          content: COMMON.COULDNT_PROPAGATE_ERR(localUser),
        });
        return;
      }

      const existed: boolean = db.users[userId] !== undefined;
      db.users[userId] = localUser; // adds or overwrites the user profile
      await interaction.editReply({
        content: COMMON.ADMIN_OPS(targetUser, localUser, true, existed, false),
      });

      if (adminAsWell) {
        dbClose(db, queues); // update the DB before calling (to have the user registered)
        await new Promise((r) => setTimeout(r, 2000)); // wait 2 sec
        await adminMgmt(interaction, client);
      } else {
        await sendDM(client, userId, COMMON.USER_GREETING(targetUser, localUser, guildName));
      }
    } else {
      if (Object.keys(db.users).length === 1) {
        await interaction.editReply({
          content: COMMON.AT_LEAST_ONE_ERR(COMMON.ADMIN),
        });
        return;
      } else {
        if (userId in db.users) {
          // Check if the user is also an admin
          if (db.adminUsers.includes(userId)) {
            db.adminUsers = db.adminUsers.filter((u) => u !== userId); // delete user as admin
            await sendDM(client, userId, COMMON.ADMIN_GOODBYE(targetUser));
          }

          // Delete the local user if no other DiscOS user uses it
          deleteUser = Object.values(db.users).filter((lu) => lu === db.users[userId]).length === 1 && propagate;
          if (deleteUser) await localUserHandler(db.users[userId], true, operation, queues); // delete the local user

          delete db.users[userId]; // delete the DiscOS user

          await sendDM(client, userId, COMMON.USER_GOODBYE(targetUser));
        }
        await interaction.editReply({
          content: COMMON.ADMIN_OPS(targetUser, localUser, false, false, deleteUser),
        });
      }
    }

    if (!adminAsWell) dbClose(db, queues); // do not overwrite the changes made by adminMgmt

    // Sync terminals
    await syncTerminalsWithConfig(false, queues);
  }

  // /admos adminmgmt <user> <add?/remove?>
  async function adminMgmt(interaction: ChatInputCommandInteraction<CacheType>, client: Client): Promise<void> {
    const userObj = interaction.options.getUser(COMMON.USER, true);
    const guildName = interaction.guild!.name;
    const targetUser: string = userObj.username;
    const userId = userObj.id;
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);

    logger.info(COMMON.ADMINMGMT_LOG(discordUsername(interaction), operation, targetUser));

    // Check if the user is a DiscOS user
    if (!Config.allowedUsers.includes(userId)) {
      await interaction.editReply({
        content: COMMON.NOT_IN_USERLIST_ERR(targetUser),
      });
      return;
    }

    const db = await dbPrep(interaction);
    if (!db) return;

    if (operation) {
      if (!db.adminUsers.includes(userId)) {
        db.adminUsers.push(userId);
        await sendDM(client, userId, COMMON.ADMIN_GREETING(targetUser, db.users[userId], guildName));
      }
      await interaction.editReply({
        content: COMMON.ADMIN_OPERATION(targetUser, true),
      });
    } else {
      if (db.adminUsers.length === 1) {
        await interaction.editReply({
          content: COMMON.AT_LEAST_ONE_ERR(COMMON.ADMIN),
        });
        return;
      } else {
        db.adminUsers = db.adminUsers.filter((id) => id !== userId);
        await interaction.editReply({
          content: COMMON.ADMIN_OPERATION(targetUser, false),
        });

        await sendDM(client, userId, COMMON.ADMIN_GOODBYE(targetUser));
      }
    }

    dbClose(db, queues);
  }

  // /admos chmgmt <channel> <add?/remove?>
  async function chMgmt(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const channel = interaction.options.getChannel(COMMON.CHANNEL, true);
    const channelId = channel.id;
    const channelName = channel.name!;
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);

    logger.info(COMMON.CHMGMT_LOG(discordUsername(interaction), operation, channelName));

    const db = await dbPrep(interaction);
    if (!db) return;

    if (operation) {
      if (!db.allowedChannels.includes(channelId)) db.allowedChannels.push(channelId);
      await interaction.editReply({
        content: COMMON.CH_OPERATION(channelName, true),
      });
    } else {
      if (db.allowedChannels.length === 1) {
        await interaction.editReply({
          content: COMMON.AT_LEAST_ONE_ERR(COMMON.CHANNEL),
        });
        return;
      } else {
        db.allowedChannels = db.allowedChannels.filter((id) => id !== channelId);
        await interaction.editReply({
          content: COMMON.CH_OPERATION(channelName, false),
        });
      }
    }

    dbClose(db, queues);
  }

  // /admos lockdown <true?>
  async function lockdown(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const enabled = interaction.options.getBoolean(COMMON.ENABLED, true);

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.lockdown = enabled; // write to DB, then load it to Config
    dbClose(db, queues);

    logger.info(COMMON.LOCKDOWN_SWITCHED_LOG(discordUsername(interaction), enabled));

    await interaction.editReply({
      content: COMMON.LOCKDOWN_REPLY(enabled),
    });
  }

  // /admos root <command>
  async function rootCommand(interaction: ChatInputCommandInteraction<CacheType>) {
    let command = interaction.options.getString(COMMON.CMD, false);
    if (!command || command.trim().length === 0) command = ''; // default command, execCommand() will handle it

    const payload: ICommandQueueItem = { user: ROOT_UID, username: ROOT_UNAME, cmd: command };

    // Backend will validate it
    queueUtils.addToAll(queues, payload);
    await execCommand(payload, interaction, command, username, 0, queues);
    // execCommand removes it from all queues
  }
}
