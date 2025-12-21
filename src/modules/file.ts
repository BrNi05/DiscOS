import type { ChatInputCommandInteraction, AutocompleteInteraction, CacheType, Attachment } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
import PATH from 'node:path';

// File type detection
import { fileTypeFromBuffer } from 'file-type';

// Consts and project-scoped types
import * as COMMON from '../common.js';
const UNKNOWN_LANG: string = '?';

// Config file
import { Config } from '../config/config.js';

// Interfaces
import type { ICommandQueueItem, IFileWritePayload } from '../shared/interfaces.js';
import type { CommandQueues } from '../interfaces/queues.js';

// Language map
import { languageMap } from '../ext/langMap.js';

// Utils
import { post, put } from '../exec/backend.js';
import { discordUsername } from '../exec/username.js';
import { execCommand } from './command.js';
import * as queueUtils from '../security/queue-utils.js';
import shellEscape from 'shell-escape';

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
  const res = await post(payload, true, true);

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
  queues: CommandQueues
): Promise<void> {
  // Check file size
  if (!checkSize(file.size)) {
    await interaction.editReply({
      content: COMMON.FILE_SIZE_ERR(Config.fileMaxSize) + username + '.',
    });
    return;
  }

  // Check if the path ends with a slash (no filename is provided)
  if (path.endsWith('/')) path += file.name;

  // Extension autocomplete
  const providedExt: string = PATH.extname(path);
  const fileExt: string = PATH.extname(file.name);
  if (!providedExt) if (fileExt) path += fileExt;

  // Handle write duplicates
  // Since DiscOS write operation is quite flexible, upon command arrival, the exact path is still not known, so a check is required here as well
  if (
    await queueUtils.handleDuplicate(
      interaction,
      username,
      queues.duplicateQueue,
      {
        user: interaction.user.id,
        username: discordUsername(interaction),
        cmd: `dcos write to ${path}`,
      },
      true
    )
  ) {
    return;
  }

  const res = await put({ url: file.url, path: path, payload: payload } as IFileWritePayload);
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
    const normalizePayload: ICommandQueueItem = { user: payload.user, username: payload.username, cmd: `dos2unix ${path}` };

    // prefixChoice: 1 - so it is treated as a watch command add added to the commandQueue (and removed later)
    await execCommand(normalizePayload, interaction, normalizePayload.cmd, username, 1, queues, true);
  }

  await interaction.editReply({
    content: COMMON.WRITE_FILE(path, username),
  });
}

// Returns the absolute path for a given path
// Falls back to CWD path on errors
// realpath handles non existing files, but errors on non existing dirs
export async function absPath(fileName: string, path: string, user: string, queues: CommandQueues): Promise<string> {
  const payload: ICommandQueueItem = { user: user, username: '', cmd: `realpath ${path}` }; // the value of username is indifferent (will not be shown)

  // Temporarily add the cmd to queues, so EB does not fails validation
  queueUtils.addToAll(queues, payload);
  const res = await post(payload, false, true);
  queueUtils.removeFromAll(queues, payload);

  let newPath: string = (res.data as Buffer).toString('utf-8').trim();

  // Compensate the trailing slash as it is removed by realpath
  if (path.endsWith('/') && !newPath.endsWith('/')) newPath += '/';

  if (newPath.includes('realpath: ')) return await cwdPath(fileName, user, queues); // error, file is new
  return newPath;
}

// Returns the path to the file appended with the CWD for the specific user
export async function cwdPath(fileName: string, user: string, queues: CommandQueues): Promise<string> {
  const payload: ICommandQueueItem = { user: user, username: '', cmd: 'pwd' }; // the value of username is indifferent (will not be shown)

  // Temporarily add the cmd to queues, so EB does not fails validation
  queueUtils.addToAll(queues, payload);
  const res = await post(payload, false, true);
  queueUtils.removeFromAll(queues, payload);

  const cwd: string = (res.data as Buffer).toString('utf-8').trim();
  if (cwd === '/') return `/${fileName}`;
  return `${cwd}/${fileName}`;
}

// Path input autocomplete handler
export async function pathAutocomplete(interaction: AutocompleteInteraction<CacheType>, queues: CommandQueues): Promise<void> {
  // Do not respond in certain situations
  if (!interaction.guild || !Config.allowedChannels.includes(interaction.channelId) || !Config.allowedUsers.includes(interaction.user.id)) {
    return;
  }

  // The current user input string
  const focusedValue = interaction.options.getFocused();

  // Determine the CWD as per the path input
  // If the input has slashes, the user already specified a directory
  let currentDir = '.';
  let filter = focusedValue;
  if (focusedValue.includes('/')) {
    // Find last slash and cut everything behind it (and the slash as well)
    const lastSlashIndex = focusedValue.lastIndexOf('/');
    currentDir = focusedValue.substring(0, lastSlashIndex);

    // The matching should be done only for the part after the last slash
    filter = focusedValue.substring(lastSlashIndex + 1);
  }
  // If the user input has no slashes, determine the CWD
  else {
    const payload: ICommandQueueItem = {
      user: interaction.user.id,
      username: '',
      cmd: 'pwd',
    };

    queueUtils.addToAll(queues, payload);
    const res = await post(payload, false, true);
    queueUtils.removeFromAll(queues, payload);

    currentDir = (res.data as Buffer).toString('utf-8').trim();
  }

  // Handle file system root
  if (currentDir === '') currentDir = '/';

  // Find suggestions
  const payload: ICommandQueueItem = {
    user: interaction.user.id,
    username: '', // the value of username is indifferent (will not be shown)
    cmd: `(cd ${shellEscape([currentDir])} >/dev/null 2>&1 && LC_ALL=C ls -A --group-directories-first${focusedValue ? ` | grep -F -- "${shellEscape([filter])}"` : ''} | head -n 10) || echo ''`,
  };

  queueUtils.addToAll(queues, payload);
  const res = await post(payload, false, true);
  queueUtils.removeFromAll(queues, payload);

  const items: string[] = (res.data as Buffer)
    .toString('utf-8')
    .split('\n')
    .filter((item) => item.trim() !== '');

  // Items array shouldn't be empty (causes Discod API error and app crash)
  if (items.length === 0) {
    items.push(focusedValue);
  }

  // Map the suggestions to the format required by Discord.js
  // Case: there were no matches - a new path is created
  if (String(res.data).trim().length === 0) {
    await interaction.respond(
      items.map((choice) => ({
        name: COMMON.NEW_FILE + choice,
        value: choice,
      }))
    );
  }
  // Case: there are matches - show full paths
  else {
    const separator: string = currentDir === '/' ? '' : '/';
    await interaction.respond(
      items.map((choice) => ({
        name: currentDir === '.' ? choice : currentDir + separator + choice,
        value: currentDir === '.' ? choice : currentDir + separator + choice,
      }))
    );
  }
}
