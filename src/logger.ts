import * as fs from "fs/promises";
import * as path from "path";
import { getConfig } from "./config.loader";

const oldLogFileExtension = "old";

function getOldLogFileName(logFileName: string): string {
  const now = new Date();
  const year = now.getFullYear().toString().padStart(4, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hour = now.getHours().toString().padStart(2, "0");
  const minute = now.getMinutes().toString().padStart(2, "0");
  const second = now.getSeconds().toString().padStart(2, "0");
  const milliseconds = now.getMilliseconds().toString().padStart(3, "0");
  return `${logFileName}.${year}${month}${day}${hour}${minute}${second}${milliseconds}.${oldLogFileExtension}`;
}

function getLogFileName(): string {
  const config = getConfig();
  return `${path.join(
    config.log?.directory || "",
    config.log?.fileName || "rssGetto.log"
  )}`;
}

export async function rollLogFile(): Promise<void> {
  try {
    const config = getConfig();
    if (!config) {
      log("Log file is not loaded. Can't roll logfile");
      return;
    }
    const logfile = getLogFileName();
    const fileSizeInBytes = (await fs.stat(logfile)).size;
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

    if (fileSizeInMegabytes > (config.log?.maxSizeInMegabytes || 100)) {
      await fs.rename(logfile, getOldLogFileName(logfile));
    }
    await cleanUpLogFiles();
  } catch (e: any) {
    log(`Error: ${e.message}`);
  }
}

export async function log(message: string): Promise<void> {
  const config = getConfig();
  const logfile = getLogFileName();
  console.log(message);
  if (config) {
    await fs.appendFile(logfile, `${new Date().toISOString()} ${message}\n`);
  }
}

async function cleanUpLogFiles(): Promise<void> {
  try {
    const config = getConfig();
    if (!config) {
      log(`Cannot cleanup log files. Config not loaded.`);
      return;
    }

    const regex = new RegExp(`${getLogFileName()}.+\.${oldLogFileExtension}`);
    const files = await (
      await fs.readdir(config.log?.directory || ".")
    )
      .filter((file) => file.match(regex))
      .sort()
      .reverse();
    if (files.length > (config.log?.numOldLogs || 1) + 1) {
      for (let i = config.log?.numOldLogs || 1; i < files.length; i++) {
        const file = files[i];
        try {
          const fullPath = path.join(config.log?.directory || "", file);
          log(`Deleting ${fullPath}`);
          await fs.rm(fullPath);
        } catch (fileDeleteError: any) {
          log(`Error deleting file: ${file}, ${fileDeleteError.message}`);
        }
      }
    }
  } catch (e: any) {
    log(`Error: ${e.message}`);
  }
}
