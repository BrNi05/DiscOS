import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import * as COMMON from '../common.js';
import type { ICommandQueueItem } from '../shared/interfaces.js';
import type { CommandQueues } from '../interfaces/queues.js';

// Add ICommandQueueItem to all queues
export function addToAll(queues: CommandQueues, req: ICommandQueueItem): void {
  queues.validationQueue.push(req);
  queues.duplicateQueue.push(req);
}

// Remove ICommandQueueItem from all queues
export function removeFromAll(queues: CommandQueues, req: ICommandQueueItem): void {
  tryRemoveInQueue(queues.validationQueue, req);
  tryRemoveInQueue(queues.duplicateQueue, req);
}

// Try to remove ICommandQueueItem from a specific queue
export function tryRemoveInQueue(queue: ICommandQueueItem[], req: ICommandQueueItem): void {
  const index = queue.findIndex((item) => item.user === req.user && item.cmd === req.cmd);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

// Check if ICommandQueueItem is in a specific queue
export function isInQueue(queue: ICommandQueueItem[], req: ICommandQueueItem): boolean {
  return queue.some((item) => item.user === req.user && item.cmd === req.cmd);
}

// Handle duplicate command detection and reply
export async function handleDuplicate(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  queue: ICommandQueueItem[],
  translated: ICommandQueueItem,
  inverseUserIdMatch = false // only detect duplicate commands for other users
): Promise<boolean> {
  const index = inverseUserIdMatch
    ? queue.findIndex((item) => item.user !== translated.user && item.cmd === translated.cmd)
    : queue.findIndex((item) => item.user === translated.user && item.cmd === translated.cmd);
  if (index !== -1) {
    await interaction.reply({
      content: COMMON.DUPLICATE_ERR + username + '.',
      flags: 64,
    });
    return true;
  }
  return false;
}

// Count the number of commands in the queue for a specific user
export function countUserCommandsInQueue(queue: ICommandQueueItem[], userId: string): number {
  return queue.reduce((count, item) => (item.user === userId ? count + 1 : count), 0);
}
