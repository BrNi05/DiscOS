import type { ChatInputCommandInteraction, CacheType, Client } from 'discord.js';
import os from 'node:os';

// Config file
import { Config } from '../config/config.js';

// Repo scoped types
import type { CommandQueues } from '../interfaces/queues.js';

// Dynamic date formatter
function formatDate(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const date = [];

  if (days > 0) date.push(`${days}d`);
  if (hours > 0 || date.length) date.push(`${hours}h`);
  if (minutes > 0 || date.length) date.push(`${minutes}m`);
  date.push(`${secs}s`);

  return date.join(' ');
}

export async function debug(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  userId: string,
  queues: CommandQueues,
  client: Client<boolean>
): Promise<void> {
  // Construct the binary list
  const READ_BIN_OVERRIDE: string[] = Config.readBinOverride;

  // Construct uptime
  const procUptimeSeconds = Math.floor(process.uptime());
  const osUptimeSeconds = Math.floor(os.uptime());

  // Construct the debug message
  const reply =
    `Debug command executed by @${username} (UID: ${userId})\n\n` +
    `Bot User:                 ${client.user!.tag}\n` +
    `Command Queue Size (D):   ${queues.duplicateQueue.length}\n` +
    `Command Queue Size (V):   ${queues.validationQueue.length}\n` +
    `Command Queue Max:        ${Config.cmdQueueMaxSize}\n` +
    `Backend URL:              ${Config.backend}\n` +
    `Database Path:            ${Config.databasePath}\n` +
    `File Max Size:            ${Config.fileMaxSize} MB\n` +
    `Read Bin Override:        ${READ_BIN_OVERRIDE.join(' | ')}\n` +
    `QuickView file types:     ${Config.quickView.join(' | ')}\n` +
    `Standalone Mode:          ${Config.standalone ? 'True' : 'False'}\n` +
    `Safe Mode:                ${Config.safemode ? 'True' : 'False'}\n` +
    `Lockdown Mode:            ${Config.lockdown ? 'True' : 'False'}\n` +
    `Server uptime:            ${formatDate(osUptimeSeconds)}\n` +
    `Process uptime:           ${formatDate(procUptimeSeconds)}`;

  await interaction.editReply({
    content: '```plaintext\n' + reply + '\n```',
  });
}
