import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import * as COMMON from '../common';
import type { ICommandQueueItem } from '../shared/types/dcbot';

export function tryRemoveInQueue(queue: ICommandQueueItem[], req: ICommandQueueItem): void {
  const index = queue.findIndex((item) => item.user === req.user && item.cmd === req.cmd);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

export function isInQueue(queue: ICommandQueueItem[], req: ICommandQueueItem): boolean {
  return queue.findIndex((item) => item.user === req.user && item.cmd === req.cmd) !== -1;
}

export async function handleDuplicate(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  queue: ICommandQueueItem[],
  translated: ICommandQueueItem
): Promise<boolean> {
  const index = queue.findIndex((item) => item.user === translated.user && item.cmd === translated.cmd);
  if (index !== -1) {
    await interaction.reply({
      content: COMMON.DUPLICATE_ERR + username + '.',
      flags: 64,
    });
    return true;
  }
  return false;
}
