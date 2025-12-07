import type { ChatInputCommandInteraction, CacheType, Message } from 'discord.js';

import * as COMMON from '../common.js';

// Sleep helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function clearHistory(
  lookback: number,
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  sendSuccessMsg: boolean
): Promise<void> {
  // Loop fetch messages from channel
  let loop: boolean = true;
  let deleteCount: number = 0;

  // Admos: if user provided no target user, clear all messages from the bot
  if (username === COMMON.CLEAR_ALL_USER) username = '';

  while (loop) {
    // Fetch the last 100 messages from the channel
    const messages = await interaction.channel?.messages.fetch({ limit: 100 });
    if (!messages) {
      await interaction.editReply({ content: COMMON.FETCH_ERR + username + '.' });
      return;
    }

    // Filter messages
    const filtered: Message[] = [...messages.values()]
      .filter((m) => m.author.id === interaction.client.user?.id)
      .filter((m) => m.content.includes(`@${username}`))
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    // Messages to be deleted
    const toDelete = lookback === -1 ? filtered : filtered.slice(0, lookback);
    if (toDelete.length == 0) {
      loop = false; // No more messages to delete
    } else {
      const deletions = toDelete.map((m) => m.delete().catch(() => null));
      await Promise.all(deletions);

      deleteCount += toDelete.length; // follow the number of deleted messages
      lookback = Math.max(0, lookback - toDelete.length); // reduce the lookback count (so the next iteration won't delete too much messages)
      loop = lookback !== 0; // Continue if there are more messages to be deleted
    }

    // Sleep a bit to avoid API rate limits
    await sleep(200);
  }

  // Reply
  if (sendSuccessMsg) {
    // admos clear
    if (username === COMMON.CLEAR_ALL_USER) {
      username = COMMON.CLEAR_ALL_USER_REPLY;
    } else {
      username = `@${username}`;
    }

    const replyContent =
      lookback === -1 ? COMMON.MSG_CLR_FOR + username + '.' : COMMON.MSG_CLR_PRE + deleteCount + COMMON.MSG_CLR_POST + username + '.';
    await interaction.editReply({ content: replyContent });
  } else {
    await interaction.deleteReply().catch(() => null);
  }
}
