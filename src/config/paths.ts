// Cross-platform config/cache paths: XDG on Unix, %APPDATA% on Windows.
import { homedir } from "node:os";
import { join } from "node:path";

const APP = "adhanline";

export function configDir(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return join(appData?.trim() || join(homedir(), "AppData", "Roaming"), APP);
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  return join(xdg?.trim() || join(homedir(), ".config"), APP);
}

export function cacheDir(): string {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    return join(local?.trim() || join(homedir(), "AppData", "Local"), APP);
  }
  const xdg = process.env.XDG_CACHE_HOME;
  return join(xdg?.trim() || join(homedir(), ".cache"), APP);
}

export function configFile(): string {
  return join(configDir(), "config.json");
}

export function cacheFile(name: string): string {
  return join(cacheDir(), name);
}

export function legacyDotfile(): string {
  return join(homedir(), `.${APP}.json`);
}
