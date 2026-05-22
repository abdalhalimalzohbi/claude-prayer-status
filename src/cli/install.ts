// `install` — merge a statusLine block into Claude Code settings.json,
// backing up the original and version-gating refreshInterval.
import { copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { stdout } from "node:process";
import { loadConfig, saveConfig } from "../config/load.js";
import { confirmDetectedLocation } from "../location/confirm.js";
import { detectAndCache } from "../location/detect.js";
import { atomicWriteJson, readJsonOrNull } from "../util/fs.js";
import { detectClaudeVersion, supportsRefreshInterval } from "./version.js";

export interface InstallOptions {
  project?: boolean;
}

export async function runInstall(options: InstallOptions): Promise<void> {
  const path = join(
    options.project ? process.cwd() : homedir(),
    ".claude",
    "settings.json",
  );

  const version = detectClaudeVersion();
  const refreshOk = supportsRefreshInterval(version);

  const block: Record<string, unknown> = {
    type: "command",
    command: "adhanline",
    padding: 0,
  };
  if (refreshOk) block.refreshInterval = 60;

  const existing =
    readJsonOrNull<Record<string, unknown>>(path) ?? {};
  if (existsSync(path)) {
    copyFileSync(path, `${path}.bak`);
    stdout.write(`Backed up existing settings → ${path}.bak\n`);
  }
  existing.statusLine = block;
  atomicWriteJson(path, existing);
  stdout.write(`Wrote statusLine into ${path}\n`);

  if (!refreshOk) {
    stdout.write(
      `Note: timer-based refresh needs Claude Code >= 2.1.97 ` +
        `(found ${version ? version.join(".") : "undetected"}). ` +
        `The line still updates on events.\n`,
    );
  }

  const config = loadConfig();
  if (!config.location.confirmed) {
    stdout.write("\nDetecting your location…\n");
    const detection = await detectAndCache();
    if (detection) {
      config.location = await confirmDetectedLocation(detection.location);
    } else {
      stdout.write(
        "Could not detect location. Run `adhanline config` to set it manually.\n",
      );
    }
    saveConfig(config);
  }

  stdout.write("\n✅ Installed. Restart Claude Code to see the prayer line.\n");
}
