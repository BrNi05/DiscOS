import type { ChatInputCommandInteraction, CacheType } from 'discord.js';

// Helpers
import * as queueUtils from '../tools/queue-utils.js';
import { post } from '../tools/backend.js';

// Config file
import { Config } from '../config.js';

// Consts
import * as COMMON from '../common.js';

// Interfaces
import type { ICommandQueueItem } from '../shared/interfaces.js';
import type { CommandQueues } from '../types/queues.js';

// Load binary overrides
// Include a trailing space to avoid some accidental matches
const READ_BIN_OVERRIDE: string[] = Config.readBinOverride.map((bin) => `${bin} `);

export async function execCommand(
  payload: ICommandQueueItem,
  interaction: ChatInputCommandInteraction<CacheType>,
  userCmd: string,
  username: string,
  prefixChoice: number,
  queues: CommandQueues, // Used for watch commands
  silent: boolean = false // To send a reply or not (internal use only)
): Promise<string> {
  let replyPrefix: string = '';

  // Default
  if (prefixChoice === 0) {
    replyPrefix = COMMON.CMD_EXEC_AS_MSG(userCmd, username);
  }
  // Watch
  else if (prefixChoice === 1) {
    replyPrefix = COMMON.CMD_EXEC_AS_MSG2(username);

    // Watch command is formatted: add it temporarily, so EB does not fails validation
    queueUtils.addToAll(queues, payload);
  }

  try {
    // Handle interactive file read/write commands
    if (READ_BIN_OVERRIDE.some((cmd) => userCmd.includes(cmd))) {
      const reply: string = COMMON.RW_USE_DEDICATED(replyPrefix);
      await interaction.editReply({
        content: reply,
      });
      return reply;
    }
    // Handle watch (interactive)
    else if (userCmd.includes('watch ')) {
      const reply: string = COMMON.WATCH_USE_DEDICATED(replyPrefix);
      await interaction.editReply({
        content: reply,
      });
      return reply;
    } else {
      const res = await post(payload, false);

      const resString: string = (res.data as Buffer).toString('utf-8').trim();
      const replyContent = resString === COMMON.BACKEND_EXEC_ERR ? COMMON.BACKEND_EXEC_ERR_OVERRIDE : resString;
      const replyContentFormatted = replyPrefix + replyContent;

      // Do not reply to internal commands
      if (!silent) {
        await interaction.editReply({
          content: '```plaintext\n' + replyContentFormatted + '\n```',
        });
      }

      return replyContent;
    }
  } catch {
    await interaction.editReply({
      content: COMMON.UNKNOWN_ERR,
    });
    return COMMON.UNKNOWN_ERR;
  } finally {
    // Remove the temp watch command (on normal use, the payload is already removed by IPCServer on backend validation)
    queueUtils.removeFromAll(queues, payload);
  }
}
