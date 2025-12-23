import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import { Config } from '../config/config.js';
import { readFile } from 'node:fs/promises';
import { ROOT_UID, ROOT_UNAME } from '../shared/consts.js';

import shellEscape from 'shell-escape';

// Get Discord username from interaction
export function discordUsername(interaction: ChatInputCommandInteraction<CacheType>): string {
  const username: string =
    interaction.member && 'nickname' in interaction.member
      ? (interaction.member.nickname ?? interaction.user.username)
      : (interaction.user.displayName ?? interaction.user.username);

  return username;
}

// Determines local user (based on Discord UID)
export async function localUser(user: string): Promise<string> {
  try {
    // Handle root user (for admos root <command>)
    if (user === ROOT_UID) {
      return ROOT_UNAME;
    }

    const dbContent: string = await readFile(Config.databasePath, 'utf-8');
    const dbParsed = JSON.parse(dbContent) as {
      users: Record<string, string>;
    };

    // Cannot be null, since only an allowedUser can send commands
    const serverUser: string = dbParsed.users[user];

    return shellEscape([serverUser]);
  } catch {
    return '.'; // Silently fail (cmd exec will return an error), but encountering such an error is basically impossible
  }
}
