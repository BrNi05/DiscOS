import type { ChatInputCommandInteraction, CacheType, Guild } from 'discord.js';

// Modules
import { execCommand } from './command';
import { startIPCServer } from '../tools/ipcServer';

// Consts and interfaces
import * as COMMON from '../common';
import type { ICommandQueueItem } from '../shared/interfaces';
import { ROOT_UID } from '../shared/consts';

// Config file
import { Config } from '../config';
import { clearHistory } from './clear';

// DB-related
import fs from 'fs';
import type { DB } from '../types/db';
import { validateDb } from '../tools/validateDb';

// Helper - listUsers
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

    if (typeof db !== 'object' || db === null) throw new Error();
    return db;
  } catch {
    await interaction.editReply({
      content: COMMON.DB_ERR,
    });

    return false;
  }
}

function dbClose(db: DB) {
  fs.writeFileSync(Config.databasePath, JSON.stringify(db, null, 2), 'utf-8');
  validateDb(); // load new db to Config
}

// Orchestration
export async function handleAdmin(
  interaction: ChatInputCommandInteraction<CacheType>,
  subcommand: string,
  username: string,
  commandQueue: ICommandQueueItem[]
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
      await userMgmt(interaction);
      break;
    }
    case COMMON.LSU: {
      await listUsers(interaction, guild, Config.allowedUsers);
      break;
    }
    case COMMON.ADMIN_MGMT: {
      await adminMgmt(interaction);
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
  }

  // /admos kill
  async function kill(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    await interaction.editReply({
      content: COMMON.SHUTDOWN_MSG,
    });

    process.exit(0);
  }

  // /admos mode <standalone?>
  async function mode(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const standalone = interaction.options.getBoolean(COMMON.STANDALONE, true);

    // Start/stop IPC server
    if (Config.standalone && !standalone) {
      Config.ipcServer = startIPCServer(commandQueue); // switch to backend mode
    } else if (!Config.standalone && standalone) {
      Config.ipcServer!.close(); // switch to standalone mode
      Config.ipcServer = null;
    }

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.standalone = standalone; // write to DB, then load it to Config
    dbClose(db);

    await interaction.editReply({
      content: COMMON.MODE_REPLY(standalone),
    });
  }

  // /admos safemode <true?>
  async function safemode(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const enabled = interaction.options.getBoolean(COMMON.CMD_VAL, true);

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.safemode = enabled; // write to DB, then load it to Config
    dbClose(db);

    await interaction.editReply({
      content: COMMON.SAFEMODE_REPLY(enabled),
    });
  }

  // /dcadm usermgmt <user> <localProfile> <add?/remove?>
  async function userMgmt(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const userObj = interaction.options.getUser(COMMON.USER, true);
    const member = userObj ? interaction.guild?.members.resolve(userObj) : null;
    const targetUser: string = member ? (member.nickname ?? member.user.username) : COMMON.CLEAR_ALL_USER;
    const userId = userObj.id;
    const localProfile = interaction.options.getString(COMMON.LOCAL_USER, true);
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);

    const db = await dbPrep(interaction);
    if (!db) return;

    if (operation) {
      const existed: boolean = db.users[userId] !== undefined;
      db.users[userId] = localProfile; // adds or overwrites the user profile
      await interaction.editReply({
        content: COMMON.ADMIN_OPS(targetUser, localProfile, true, existed),
      });
    } else {
      if (Object.keys(db.users).length === 1) {
        await interaction.editReply({
          content: COMMON.AT_LEAST_ONE_ERR(COMMON.ADMIN),
        });
        return;
      } else {
        if (userId in db.users) delete db.users[userId];
        await interaction.editReply({
          content: COMMON.ADMIN_OPS(targetUser, localProfile, false, false),
        });
      }
    }

    dbClose(db);
  }

  // /dcadm adminmgmt <user> <add?/remove?>
  async function adminMgmt(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const userObj = interaction.options.getUser(COMMON.USER, true);
    const member = userObj ? interaction.guild?.members.resolve(userObj) : null;
    const targetUser: string = member ? (member.nickname ?? member.user.username) : COMMON.CLEAR_ALL_USER;
    const userId = userObj.id;
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);

    const db = await dbPrep(interaction);
    if (!db) return;

    if (operation) {
      if (!db.adminUsers.includes(userId)) db.adminUsers.push(userId);
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
      }
    }

    dbClose(db);
  }

  // /dcadm chmgmt <channel> <add?/remove?>
  async function chMgmt(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const channel = interaction.options.getChannel(COMMON.CHANNEL, true);
    const channelId = channel.id;
    const channelName = channel.name!;
    const operation = interaction.options.getBoolean(COMMON.OPERATION, true);

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

    dbClose(db);
  }

  // /dcadm lockdown <true?>
  async function lockdown(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const enabled = interaction.options.getBoolean(COMMON.ENABLED, true);

    // Write databse
    const db = await dbPrep(interaction);
    if (!db) return;
    db.lockdown = enabled; // write to DB, then load it to Config
    dbClose(db);

    await interaction.editReply({
      content: COMMON.LOCKDOWN_REPLY(enabled),
    });
  }

  // /admos root <command>
  async function rootCommand(interaction: ChatInputCommandInteraction<CacheType>) {
    const command = interaction.options.getString(COMMON.CMD, true);
    const payload: ICommandQueueItem = { user: ROOT_UID, cmd: command };
    commandQueue.push(payload); // as backend will validate it
    await execCommand(payload, interaction, command, username, 0, commandQueue);
  }
}
