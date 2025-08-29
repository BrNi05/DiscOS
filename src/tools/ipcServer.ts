import * as queueUtils from '../tools/queue-utils';

import net from 'net';
import fs from 'fs';

import * as COMMON from '../common';
import { SOCKET_PATH } from '../shared/consts';
import type { ICommandQueueItem } from '../shared/interfaces';

// Config file
import { Config } from '../config';

export function startIPCServer(commandQueue: ICommandQueueItem[]): net.Server {
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
      if (queueUtils.isInQueue(commandQueue, req)) {
        queueUtils.tryRemoveInQueue(commandQueue, req);
        socket.write(JSON.stringify({ valid: true }));
      } else {
        socket.write(JSON.stringify({ valid: false }));
      }
      socket.end();
    });
  });

  server.listen(SOCKET_PATH, () => {
    // When running in a Docker container: only root has access to the socket
    // When running as a Systemd service: only the discos user has access to the socket
    // Be sure to execute the external backend (if needed) with proper permissions (proper user)
    fs.chmodSync(SOCKET_PATH, 0o600);
    console.log(COMMON.LISTENING + SOCKET_PATH);
  });

  return server;
}
