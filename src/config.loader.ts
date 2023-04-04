import * as fs from "fs/promises";
import { log } from "./logger";
import { Config } from "./models/Config";

/**
 * Loads config from file path
 * @param {string} file path to config
 * @returns {Promise<Config>} resulting config
 */
export async function loadConfig(file: string): Promise<Config> {
  const jsonRaw = await fs.readFile(file, { encoding: "utf8" });
  const json = JSON.parse(jsonRaw);

  for (const subscription of json.subscriptions) {
    if (subscription.subscriptionType) {
      subscription.subscriptionType = subscription.subscriptionType.toLowerCase()
    }
  }

  config = json as Config;
  return config;
}

let config: Config = null;

export function getConfig(): Config {
  if (!config) {
    log("Config not loaded. Load config.");
  }

  return config;
}
