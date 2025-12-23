import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import { readFile } from 'node:fs/promises';

import { Config } from '../config/config.js';
import { ROOT_UID, ROOT_UNAME } from '../shared/consts.js';
import { DB_ERR } from '../common.js';
import logger from '../logging/logger.js';

import shellEscape from 'shell-escape';

// DB local user cache
let dbUserCache: Record<string, string> = {};

// Get Discord username from interaction
export function discordUsername(interaction: ChatInputCommandInteraction<CacheType>): string {
  const username: string =
    interaction.member && 'nickname' in interaction.member
      ? (interaction.member.nickname ?? interaction.user.username)
      : (interaction.user.displayName ?? interaction.user.username);

  return username;
}

// Refreshed the DB cache
export async function refreshDbCache(): Promise<void> {
  try {
    const dbContent: string = await readFile(Config.databasePath, 'utf-8');
    const dbParsed = JSON.parse(dbContent) as {
      users: Record<string, string>;
    };
    dbUserCache = dbParsed.users;
  } catch {
    dbUserCache = {}; // such exception should never really happen
    logger.error(DB_ERR);
    process.exit(1);
  }
}

// Determines local user (based on Discord UID)
export function localUser(user: string): string {
  // Handle root user (for admos root <command>)
  if (user === ROOT_UID) return ROOT_UNAME;
  return shellEscape([dbUserCache[user]]); // always defined
}
