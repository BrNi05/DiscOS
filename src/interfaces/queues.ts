import type { ICommandQueueItem } from '../shared/interfaces.js';

export interface CommandQueues {
  readonly validationQueue: ICommandQueueItem[];
  readonly duplicateQueue: ICommandQueueItem[];
}
