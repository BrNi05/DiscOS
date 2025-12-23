import * as COMMON from '../common.js';
import dotenv from 'dotenv';
import { Config } from './config.js';
import logger from '../logging/logger.js';
import { refreshDbCache } from '../exec/username.js';

dotenv.config({ quiet: true });

export async function validateDotenv(): Promise<boolean> {
  const requiredEnvVars = [
    'BOT_TOKEN',
    'APP_ID',
    'GUILD_IDS',
    'CMD_QUEUE_MAX_SIZE',
    'BACKEND',
    'DATABASE_PATH',
    'FILE_MAX_SIZE',
    'READ_BIN_OVERRIDE',
    'QUICK_VIEW',
    'QUICK_VIEW_MAX_LENGTH',
    'USER_RATE_LIMIT',
  ];

  const missingVars: string[] = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    logger.error(COMMON.ENV_MISSING_VAR(missingVars));
    return false;
  }

  // BOT_TOKEN is 59 characters long or more
  if (process.env.BOT_TOKEN!.length < 59) {
    logger.error(COMMON.ENV_TOKEN);
    return false;
  }

  // APP_ID is numberic and at least 17 characters long
  if (!/^\d{17,}$/.test(process.env.APP_ID!)) {
    logger.error(COMMON.ENV_APPID);
    return false;
  }

  // GUILD_IDS are comma-separated numeric strings, at least 17 characters long
  const guildIds = process.env.GUILD_IDS!.split(',').map((id) => id.trim());
  if (guildIds.some((id) => !/^\d{17,}$/.test(id))) {
    logger.error(COMMON.ENV_GUILDS);
    return false;
  }

  // CMD_QUEUE_MAX_SIZE is a positive integer
  const cmdQueueMaxSize = Number.parseInt(process.env.CMD_QUEUE_MAX_SIZE!, 10);
  if (Number.isNaN(cmdQueueMaxSize) || cmdQueueMaxSize <= 0) {
    logger.error(COMMON.ENV_QUEUE_MAX);
    return false;
  }
  Config.cmdQueueMaxSize = cmdQueueMaxSize;

  // BACKEND is a non-empty string
  if (!process.env.BACKEND || process.env.BACKEND.trim() === '') {
    logger.error(COMMON.ENV_BACKEND);
    return false;
  }
  Config.backend = process.env.BACKEND!;

  // DATABASE_PATH
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    logger.error('DiscOS ERROR: DATABASE_PATH must be a non-empty string.');
    return false;
  }
  Config.databasePath = process.env.DATABASE_PATH!;
  await refreshDbCache(); // load DB cache for the first time in DiscOS lifecycle

  // FILE_MAX_SIZE is a positive integer and not more then 1000MB
  const fileMaxSize = Number.parseInt(process.env.FILE_MAX_SIZE!, 10);
  if (Number.isNaN(fileMaxSize) || fileMaxSize <= 0 || fileMaxSize > 1000) {
    logger.error(COMMON.ENV_FILE_MAX);
    return false;
  }
  Config.fileMaxSize = fileMaxSize;

  // READ_BIN_OVERRIDE is a comma-separated list of binaries
  const readBinOverride = process.env.READ_BIN_OVERRIDE!.split(',').map((bin) => bin.trim());
  if (readBinOverride.length === 0 || readBinOverride.includes('')) {
    logger.error(COMMON.ENV_BIN_OVERRIDE);
    return false;
  }
  Config.readBinOverride = readBinOverride;

  // QUICK_VIEW is a comma-separated list of file extensions
  const quickView = process.env.QUICK_VIEW!.split(',').map((ext) => ext.trim());
  if (quickView.length === 0 || quickView.some((ext) => ext === '' || ext === '?')) {
    logger.error(COMMON.ENV_QUICK_VIEW);
    return false;
  }
  Config.quickView = quickView;

  // QUICK_VIEW_MAX_LENGTH is a positive integer, max 2000
  const quickViewMaxLength = Number.parseInt(process.env.QUICK_VIEW_MAX_LENGTH!, 10);
  if (Number.isNaN(quickViewMaxLength) || quickViewMaxLength <= 0 || quickViewMaxLength > 2000) {
    logger.error(COMMON.ENV_QUICK_VIEW_MAX_LENGTH);
    return false;
  }
  Config.quickViewMaxLength = quickViewMaxLength;

  // USER_RATE_LIMIT is a positive integer, greater than or equal to 2, maximum 30
  const userRateLimit = Number.parseInt(process.env.USER_RATE_LIMIT!, 10);
  if (Number.isNaN(userRateLimit) || userRateLimit < 2 || userRateLimit > 30) {
    logger.error(COMMON.ENV_USER_RATE_LIMIT);
    return false;
  }
  Config.userRateLimit = userRateLimit;

  return true;
}
