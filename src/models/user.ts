import { IS_TEST_MODE } from '../exec/terminal-manager.js';
import logger from '../logging/logger.js';
import * as COMMON from '../common.js';

import pty, { type IPty } from 'node-pty';

export class User {
  // Discord user ID (unique)
  dcUid: string;

  // Discord username (guild name or global name)
  dcUname: string;

  // Local (host) user
  localUser: string;

  // PTY instance for the user
  ptyProcess: IPty;

  // Buffer for data from PTY
  buffer: string = '';

  // Used to disables respawning
  respawn: boolean = true;

  constructor(dcUid: string, dcUname: string, localUser: string) {
    this.dcUid = dcUid;
    this.dcUname = dcUname;
    this.localUser = localUser;
    this.ptyProcess = this.spawnPty();
  }

  // Initialize the PTY for the user
  spawnPty(): IPty {
    let cwd = `/home/${this.localUser}`;
    let home = `/home/${this.localUser}`;

    // For testing purposes, allow overriding the local user to root
    //! Should only be used in test and dev environments
    if (IS_TEST_MODE) {
      this.localUser = 'root';
      cwd = '/';
      home = '/';
    }

    const newPtyProcess: IPty = pty.spawn('sudo', ['-u', this.localUser, '-i', '/bin/bash'], {
      name: `xterm`,
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        HOME: home,
        USER: this.localUser,
        LOGNAME: this.localUser,
        SHELL: '/bin/bash',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        LANG: 'C.UTF-8',
      },
    });

    // Handle incoming data
    newPtyProcess.onData((data) => {
      this.buffer += data;
    });

    // If the PTY exists for some reason, recreate a PTY session for the user
    newPtyProcess.onExit(() => {
      if (!this.respawn) return;
      this.ptyProcess = this.spawnPty();

      logger.warn(COMMON.terminalRespawnMessage(this.dcUname, this.localUser));
    });

    return newPtyProcess;
  }

  // Write command to the PTY
  write(cmd: string): void {
    this.ptyProcess.write(cmd + '\n');
  }

  // Destroy the PTY
  destroy(): void {
    this.respawn = false;
    this.ptyProcess.kill();
  }
}
