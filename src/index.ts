import axios from "axios";
import * as path from "path";
import { XMLParser } from "fast-xml-parser";
import * as fs from "fs/promises";
import * as cron from "node-cron";
import { RssResponse } from "./models/RssResponse";
import { Config, loadConfig, Subscription } from "./config.loader";

let config: Config;

let subscriptions: Subscription[];
const parser = new XMLParser();

let cache: { [key: string]: RssResponse } = {};

function clearCache() {
  cache = {};
}

async function log(message: string): Promise<void> {
  const logfile = config.logFile || "rssGetto.log";
  await fs.appendFile(logfile, `${new Date().toISOString()} ${message}\n`);
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
  } catch (e) {
    log(`Error reading file: ${title}`);
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
async function rollLogFile() {
  try {
    const logfile = config.logFile || "rssGetto.log";
    const fileSizeInBytes = (await fs.stat(logfile)).size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    if (fileSizeInMegabytes > 0.1) {
      fs.rename(
        logfile,
        `${logfile}.${year}${month}${day}${hour}${minute}${second}.old`
      );
    }
  } catch (e: any) {
    log(`Error: ${e.message}`);
  }
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
        if ((subscription.ignoreCase ?? true) === true) {
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
    log(`Some bs happened with running this thing. ${(e && e.message) || "..But what we'll never know."}`)
  } finally {
    clearCache();
    log("Finished");
    rollLogFile();
  }
}


function init() {
  console.log('init - why not use pino')

  loadConfig(path.join(__dirname, 'config.json'))
    .then((loadedConf: Config) => {
      config = loadedConf;

      log("Starting service");

      cron.schedule(config.cron, run);
      
      run();
    }).catch((e) => {
      console.log('Error initializing...', e)
    })
}

init();

process.on("exit", (code) => {
  log(`Stopping with code: ${code}`);
});
