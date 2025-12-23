import fs from 'node:fs';

import * as COMMON from '../common.js';
import type { DB } from '../shared/types.js';
import { Config } from './config.js';
import logger from '../logging/logger.js';

import { updateExternalBackendDatabase } from '../exec/backend.js';

import type { CommandQueues } from '../interfaces/queues.js';

// UDI and CID validation
const isValidId = (id: string) => /^\d{17,}$/.test(id);

// Validate database structure and load data into config
// Also called after admin commands that modify the DB
export function validateDb(queues: CommandQueues): boolean {
  // Read DB
  let db: DB;
  try {
    const rawData = fs.readFileSync(process.env.DATABASE_PATH!, 'utf-8');
    db = JSON.parse(rawData) as DB;
  } catch {
    logger.error(COMMON.DB_ERR);
    return false;
  }

  // Validate db structure
  if (typeof db !== 'object' || db === null) {
    logger.error(COMMON.DB_ERR);
    return false;
  }

  // Read db fields
  const { users, adminUsers, allowedChannels } = db;

  // Validate users
  if (typeof users !== 'object' || users === null) {
    logger.error(COMMON.DB_USER_ERR);
    return false;
  }

  const userIds = Object.keys(users);
  if (userIds.length === 0) {
    logger.warn(COMMON.DB_USERS_EMPTY);
  }

  if (userIds.some((id) => !isValidId(id))) {
    logger.error(COMMON.DB_USERS_INVALID);
    return false;
  }

  // Validate adminUsers
  if (!Array.isArray(adminUsers)) {
    logger.error(COMMON.DB_ADMIN_ERR);
    return false;
  }
  if (adminUsers.length === 0) {
    logger.error(COMMON.DB_NO_ADMIN);
    return false;
  }
  if (adminUsers.some((id) => !isValidId(id))) {
    logger.error(COMMON.DB_ADMIN_INVALID);
    return false;
  }

  // Validate allowedChannels
  if (allowedChannels !== undefined) {
    if (!Array.isArray(allowedChannels)) {
      logger.error(COMMON.DB_ALLOWED_CHANNELS_ARRAY);
      return false;
    }
    if (allowedChannels.length === 0) {
      logger.warn(COMMON.DB_ALLOWED_CH_EMPTY);
    }
    if (allowedChannels.some((id) => !isValidId(id))) {
      logger.error(COMMON.DB_ALLOWED_CH_INVALID);
      return false;
    }
  }

  // Validate standalone, safemode, lockdown
  const booleanFields = ['standalone', 'safemode', 'lockdown'] as const;
  for (const key of booleanFields) {
    if (typeof db[key] !== 'boolean') {
      logger.error(`${COMMON.DB_BOOLEAN_ERR} (${key})`);
      return false;
    }
  }

  // Load DB data into config file
  Config.allowedUsers = userIds;
  Config.adminUsers = adminUsers;
  Config.allowedChannels = allowedChannels;
  Config.standalone = db.standalone;
  Config.safemode = db.safemode;
  Config.lockdown = db.lockdown;

  // Update the external backend DB
  if (!Config.standalone) void updateExternalBackendDatabase(db, queues);

  return true;
}
