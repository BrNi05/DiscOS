import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import { execCommand } from './command';

import * as COMMON from '../common';

// Repo scoped types
import type { ICommandQueueItem } from '../shared/interfaces';

export async function watch(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  userId: string,
  target: string,
  interval: number,
  repeat: number,
  commandQueue: ICommandQueueItem[] // Passed to execCommand() to insert formatted command to validation queue
): Promise<void> {
  let execOutput: string; // capture what is send to Discord
  let lastGoodReply: string = ''; // capture the last not errored reply to Discord

  // Execute a loop repeat times
  for (let i = 0; i < repeat; i++) {
    // Precompute
    const cmd = COMMON.WATCH_CMD_BUILD(target, interval, i, repeat);
    const payload: ICommandQueueItem = { user: userId, cmd: cmd };

    if (i === 0) {
      lastGoodReply = cmd; // if watch fails on the first iteration, don't break the clear logic and log the username
    }

    // Execute the command
    execOutput = await execCommand(payload, interaction, cmd, username, 1, commandQueue);

    // Check the previous reply (so execOutput)
    const prevReplyContent = execOutput;
    if (prevReplyContent.includes(COMMON.TOO_MANY_REQ) || prevReplyContent.includes(COMMON.DISCOS_GENERIC_ERR)) {
      const replyContent = `${lastGoodReply}\n\n${prevReplyContent}\n${COMMON.WATCH_TERM}`;
      await interaction.editReply({
        content: '```plaintext\n' + replyContent + '\n```',
      });
      break; // exec errored, no need to continue the loop
    } else {
      lastGoodReply = prevReplyContent;
    }

    // Wait for the specified interval before repeating
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
