import * as fs from "fs/promises";

export interface Subscription {
  name: string,
  regex: string,
  rssFeedUrl: string,
  saveLocation: string,
  ignoreCase: boolean
}

export interface Config {
  cron: string,
  doneDirectory: string,
  logFile: string,
  subscriptions: Subscription[]
}

/**
 * Loads config from file path
 * @param {string} file path to config
 * @returns {Promise<Config>} resulting config
 */
export async function loadConfig(file: string) {
  const jsonRaw = await fs.readFile(file, { encoding: 'utf8'});
  const json = JSON.parse(jsonRaw);

  return json as Config
}
