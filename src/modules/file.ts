import type { ChatInputCommandInteraction, CacheType, Attachment } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
import PATH from 'path';

// File type detection
import { fileTypeFromBuffer } from 'file-type';

// Consts and project-scoped types
import * as COMMON from '../common';
const UNKNOWN_LANG: string = '?';

// Config file
import { Config } from '../config';

// Repo scoped types
import type { ICommandQueueItem, IFileWritePayload } from '../shared/interfaces';

// Language map
import { languageMap } from '../ext/langMap';

// Utils
import { post, put } from '../tools/backend';
import { execCommand } from './command';

// Check file size to align with Discord API limits (as it just silently fails)
export function checkSize(bytes: number): boolean {
  if (bytes > Config.fileMaxSize * 1000 * 1000) {
    return false;
  }
  return true;
}

export async function read(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  path: string,
  payload: ICommandQueueItem
): Promise<void> {
  const res = await post(payload, true);

  const buffer = res.data as Buffer;

  // Handle file size limit errors
  if (!checkSize(buffer.length)) {
    await interaction.editReply({
      content: COMMON.FILE_SIZE_ERR(Config.fileMaxSize) + username + '.',
    });
    return;
  }

  // User-defined file type check
  const ext = PATH.extname(path).toLowerCase(); // contains the dot, e.g. '.txt'
  let lang = languageMap[ext] ?? UNKNOWN_LANG; // file with no extension falls back to 'plaintext'

  // Validation step 1 - Handle read errors for text-based files (not for other, like images)
  let isUtf8Decodable: boolean = false; // recognise custom file extensions that that are associated with text files
  if (lang != UNKNOWN_LANG || Config.quickView.includes(ext)) {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(buffer);
      isUtf8Decodable = true;
    } catch {
      isUtf8Decodable = false;
      await interaction.editReply({
        content: COMMON.OS_ERR_MSG(username),
      });
      return;
    }
  }

  // Validation step 2 - File corruption check (for non-text files)
  const fileType = await fileTypeFromBuffer(buffer);

  if (!fileType && lang === UNKNOWN_LANG && !isUtf8Decodable) {
    await interaction.editReply({
      content: COMMON.FILE_CORRUPT_ERR(username),
    });
    return;
  }

  if (lang === UNKNOWN_LANG) lang = languageMap['.txt']; // always display unknown but utf8-decodable files as plaintext

  // Continue QuickView or normal display
  if (Config.quickView.includes(`.${ext.slice(1)}`)) {
    const text: string = buffer.toString('utf-8').trim();
    if (text.length < Config.quickViewMaxLength - COMMON.READ_FILE_QUICK_LENGTH - path.length - username.length) {
      await interaction.editReply({
        content: COMMON.READ_FILE_QUICK(path, username) + `\`\`\`${lang}\n${text}\n\`\`\``,
      });
      return;
    }
  }

  // Not text file or too long for QuickView
  const attachment = new AttachmentBuilder(buffer).setName(PATH.basename(path));
  await interaction.editReply({
    content: COMMON.READ_FILE(path, username),
    files: [attachment],
  });
}

export async function write(
  interaction: ChatInputCommandInteraction<CacheType>,
  username: string,
  file: Attachment,
  path: string,
  payload: ICommandQueueItem,
  commandQueue: ICommandQueueItem[]
): Promise<void> {
  // Build the payload
  const req: IFileWritePayload = { url: file.url, path: path, payload: payload };

  // Check file size
  if (!checkSize(file.size)) {
    await interaction.editReply({
      content: COMMON.FILE_SIZE_ERR(Config.fileMaxSize) + username + '.',
    });
    return;
  }

  // Extension autocomplete
  const providedExt: string = PATH.extname(path);
  const fileExt: string = PATH.extname(file.name);
  if (!providedExt) {
    if (fileExt) {
      path += fileExt;
      path.trim();
      req.path = path;
    }
  }

  const res = await put(req);
  const resString: string = String(res.data);
  const statusCode: number = res.status;

  if (statusCode !== 200) {
    await interaction.editReply({
      content: COMMON.BACKEND_ERR_MSG(username, statusCode, resString),
    });
    return;
  }

  // Normalize line endings for text-based files
  if (languageMap[fileExt] || Config.quickView.includes(fileExt)) {
    const normalizePayload: ICommandQueueItem = { user: payload.user, cmd: `dos2unix ${req.path}` };

    // prefixChoice: 1 - so it is treated as a watch command add added to the commandQueue (and removed later)
    await execCommand(normalizePayload, interaction, normalizePayload.cmd, username, 1, commandQueue, true);
  }

  await interaction.editReply({
    content: COMMON.WRITE_FILE(path, username),
  });
}
