// `config` — interactive editor + scriptable `get`/`set`.
import { stdout } from "node:process";
import { META_FILE } from "../cache/keys.js";
import { readCache } from "../cache/store.js";
import { confirmDetectedLocation, promptManualLocation } from "../location/confirm.js";
import { detectAndCache } from "../location/detect.js";
import { clearDrift } from "../location/travel.js";
import { CALCULATION_METHODS } from "../types.js";
import type { CacheMeta, ThemeName } from "../types.js";
import { ask, choose, confirm } from "../util/prompt.js";
import { loadConfig, saveConfig } from "./load.js";
import { normalizeConfig } from "./schema.js";

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, key) =>
        o && typeof o === "object" ? (o as Record<string, unknown>)[key] : undefined,
      obj,
    );
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): boolean {
  const keys = path.split(".");
  let node = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = node[keys[i]!];
    if (!next || typeof next !== "object") return false;
    node = next as Record<string, unknown>;
  }
  const leaf = keys[keys.length - 1]!;
  if (!(leaf in node)) return false;
  node[leaf] = value;
  return true;
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return raw;
}

function configGet(key: string | undefined): void {
  if (!key) {
    stdout.write("usage: adhanline config get <key>\n");
    return;
  }
  const value = getByPath(loadConfig(), key);
  stdout.write(`${value === undefined ? "(unset)" : JSON.stringify(value)}\n`);
}

function configSet(key: string | undefined, raw: string | undefined): void {
  if (!key || raw === undefined) {
    stdout.write("usage: adhanline config set <key> <value>\n");
    return;
  }
  const config = loadConfig() as unknown as Record<string, unknown>;
  if (!setByPath(config, key, parseValue(raw))) {
    stdout.write(`Unknown config key: ${key}\n`);
    return;
  }
  const normalized = normalizeConfig(config);
  saveConfig(normalized);
  stdout.write(`${key} = ${JSON.stringify(getByPath(normalized, key))}\n`);
}

async function configInteractive(): Promise<void> {
  const config = loadConfig();

  const meta = readCache<CacheMeta>(META_FILE)?.data;
  if (meta?.locationDriftPending && meta.pendingLocation) {
    const p = meta.pendingLocation;
    stdout.write(`\n⚠ Location drift detected: now near ${p.city ?? "?"}, ${p.country ?? "?"}\n`);
    if (await confirm("Switch to the new location?", false)) {
      config.location = { ...p, source: "auto", confirmed: true };
    }
    clearDrift();
  }

  stdout.write("\n— Location —\n");
  const locChoice = await choose(
    "How would you like to set your location?",
    ["keep current", "auto-detect", "enter manually"] as const,
    0,
  );
  if (locChoice === "auto-detect") {
    stdout.write("Detecting…\n");
    const detection = await detectAndCache();
    config.location = detection
      ? await confirmDetectedLocation(detection.location)
      : await promptManualLocation(config.location);
  } else if (locChoice === "enter manually") {
    config.location = await promptManualLocation(config.location);
  }

  stdout.write("\n— Calculation —\n");
  const methodIdx = Math.max(0, CALCULATION_METHODS.indexOf(config.calculation.method));
  config.calculation.method = await choose(
    "Calculation method",
    CALCULATION_METHODS,
    methodIdx,
  );

  stdout.write("\n— Display —\n");
  config.display.theme = await choose(
    "Theme",
    ["minimal", "neon", "powerline"] as const satisfies readonly ThemeName[],
    0,
  );

  stdout.write("\n— Dhikr —\n");
  config.dhikr.enabled = await confirm("Show rotating dhikr on line 2?", config.dhikr.enabled);
  if (config.dhikr.enabled) {
    const interval = Number(
      await ask("Dhikr interval (minutes)", String(config.dhikr.intervalMinutes)),
    );
    if (Number.isFinite(interval)) config.dhikr.intervalMinutes = interval;
  }

  saveConfig(config);
  stdout.write("\n✅ Config saved.\n");
}

export async function runConfig(args: string[]): Promise<void> {
  const sub = args[0];
  if (sub === "get") return configGet(args[1]);
  if (sub === "set") return configSet(args[1], args[2]);
  return configInteractive();
}
