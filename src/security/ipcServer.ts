import * as queueUtils from '../security/queue-utils.js';

import net from 'node:net';
import fs from 'node:fs';

import * as COMMON from '../common.js';
import { SOCKET_PATH } from '../shared/consts.js';
import type { ICommandQueueItem } from '../shared/interfaces.js';
import type { CommandQueues } from '../interfaces/queues.js';
import logger from '../logging/logger.js';

// Config file
import { Config } from '../config/config.js';

export function startIPCServer(cmdQueues: CommandQueues): net.Server {
  // Ensure the socket does not already exist
  try {
    fs.unlinkSync(SOCKET_PATH);
  } catch {
    /* if an error occurs, that means the socket is not present, so nothing to do */
  }

  const server = net.createServer((socket) => {
    socket.on('data', (data) => {
      // safemode: false
      if (!Config.safemode) {
        socket.write(JSON.stringify({ valid: true }));
        socket.end();
      }

      // Normal operation (safemode: true)
      let req: ICommandQueueItem;
      try {
        req = JSON.parse(data.toString()) as ICommandQueueItem;
      } catch {
        socket.write(JSON.stringify({ valid: false }));
        socket.end();
        return;
      }

      // The moment a validation request is received, invalidate the commmand so even well timed spoofing attempts will fail
      if (queueUtils.isInQueue(cmdQueues.validationQueue, req)) {
        queueUtils.tryRemoveInQueue(cmdQueues.validationQueue, req);
        //queueUtils.tryRemoveInQueue(cmdQueues.duplicateQueue, req); - would break duplicate detection, will be done after processing
        socket.write(JSON.stringify({ valid: true }));
      } else {
        socket.write(JSON.stringify({ valid: false }));
      }
      socket.end();
    });
  });

  server.listen(SOCKET_PATH, () => {
    // When running in a Docker container: only root has access to the socket
    // When running as a Systemd service: only the discos user (and of course root) has access to the socket
    // Be sure to execute the external backend (if needed) with proper permissions (proper user)
    fs.chmodSync(SOCKET_PATH, 0o600);
    logger.info(COMMON.LISTENING + SOCKET_PATH);
  });

  return server;
}
