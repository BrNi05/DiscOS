import type { ICommandQueueItem } from '../shared/interfaces';

export interface CommandQueues {
  readonly validationQueue: ICommandQueueItem[];
  readonly duplicateQueue: ICommandQueueItem[];
}
