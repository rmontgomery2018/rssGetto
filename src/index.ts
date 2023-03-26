import axios from "axios";
import * as path from "path";
import { XMLParser } from "fast-xml-parser";
import * as fs from "fs/promises";
import * as cron from "node-cron";
import { RssResponse } from "./models/RssResponse";
import { loadConfig } from "./config.loader";
import { log, rollLogFile } from "./logger";
import { Config, Subscription } from "./models/Config";

let config: Config;

let subscriptions: Subscription[];
const parser = new XMLParser();

let cache: { [key: string]: RssResponse } = {};

function clearCache() {
  cache = {};
}

async function getRssFeed(rssFeedUrl: string): Promise<RssResponse> {
  let response = cache[rssFeedUrl];
  if (!response) {
    response = parser.parse(
      (await axios.get<string>(rssFeedUrl)).data
    ) as RssResponse;
    cache[rssFeedUrl] = response;
  }
  return response;
}

async function getTorrentArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await axios.request<ArrayBuffer>({
    responseType: "arraybuffer",
    method: "get",
    url,
  });

  return response.data;
}

async function saveTorrent(url: string, path: string): Promise<void> {
  const arrayBuffer = (await getTorrentArrayBuffer(url)) as Uint8Array;
  return fs.writeFile(path, arrayBuffer);
}

async function getLastDownloadDate(title: string): Promise<Date> {
  const fileName = path.join(config.doneDirectory, `${title}.run`);
  try {
    const data = (await fs.readFile(fileName)).toString();
    if (!data) {
      return null;
    }
    return new Date(data);
  } catch (e: any) {
    log(`getLastDownloadDate - Error reading file: ${title}`);
    return null;
  }
}

async function updateLastRun(
  title: string,
  lastPubDate: string
): Promise<void> {
  const fileName = path.join(config.doneDirectory, `${title}.run`);
  return fs.writeFile(fileName, lastPubDate);
}

async function run() {
  try {
    subscriptions = config.subscriptions;

    await log("Starting run");
    for (const subscription of subscriptions) {
      try {
        const response = await getRssFeed(subscription.rssFeedUrl);
        const items = response?.rss?.channel?.item;
        if (!items) {
          log("Bad response from rss feed");
          log(JSON.stringify(response));
          continue;
        }
        let regexFlags = "";
        if ((subscription.ignoreCase || true) === true) {
          regexFlags += "i";
        }
        const regEx = new RegExp(subscription.regex, regexFlags);
        const matchedItems = items.filter((item) => item.title.match(regEx));
        for (const item of matchedItems) {
          const publishedDate = new Date(item.pubDate);
          const lastDownloadedDate = await getLastDownloadDate(
            subscription.name
          );
          if (
            lastDownloadedDate == null ||
            lastDownloadedDate < publishedDate
          ) {
            await saveTorrent(
              item.link,
              path.join(subscription.saveLocation, `${item.title}.torrent`)
            );
            await updateLastRun(subscription.name, item.pubDate);
            log(`Added torrent for ${item.title}`);
          }
        }

        if (matchedItems.length === 0) {
          log(`No new items for ${subscription.name}`);
        }
      } catch (e: any) {
        log(`Error: ${e.message}`);
      }
    }
  } catch (e: any) {
    log(`Error: ${e && e.message}`);
  } finally {
    clearCache();
    log("Finished");
    rollLogFile();
  }
}

async function init() {
  try {
    const loadedConf = await loadConfig(path.join(__dirname, "config.json"));
    config = loadedConf;

    log("Starting service");

    cron.schedule(config.cron, run);
    run();
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

init();

process.on("exit", (code) => {
  log(`Stopping with code: ${code}`);
});
