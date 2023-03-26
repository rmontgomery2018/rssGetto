export interface Subscription {
  name: string;
  regex: string;
  rssFeedUrl: string;
  saveLocation: string;
  ignoreCase: boolean;
}

export interface Config {
  cron: string;
  doneDirectory: string;
  log: {
    directory: string;
    fileName?: string;
    numOldLogs?: number;
    maxSizeInMegabytes?: number;
  };
  subscriptions: Subscription[];
}
