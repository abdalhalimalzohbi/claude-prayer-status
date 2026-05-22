// `doctor` — diagnostics: location, paths, prayer times, cache, CC version.
import { stdout } from "node:process";
import { LOCATION_FILE, LOCATION_TTL_MS, META_FILE } from "../cache/keys.js";
import { isStale, readCache } from "../cache/store.js";
import { loadConfig } from "../config/load.js";
import { cacheDir, configFile } from "../config/paths.js";
import { detectAndCache } from "../location/detect.js";
import { evaluateDrift } from "../location/travel.js";
import { isComputable } from "../prayer/calculate.js";
import { getPrayerDay } from "../prayer/day.js";
import { PRAYER_LABELS } from "../status/line1-prayers.js";
import type { CacheMeta, LocationData } from "../types.js";
import { detectClaudeVersion, supportsRefreshInterval } from "./version.js";

function line(label: string, value: string): void {
  stdout.write(`  ${label.padEnd(18)} ${value}\n`);
}

export async function runDoctor(): Promise<void> {
  const config = loadConfig();
  const loc = config.location;

  // Weekly travel-drift check — only when the location cache has gone stale.
  if (
    loc.confirmed &&
    isComputable(loc) &&
    isStale(readCache(LOCATION_FILE), LOCATION_TTL_MS)
  ) {
    stdout.write("Refreshing location (weekly check)…\n");
    const fresh = await detectAndCache();
    if (fresh) evaluateDrift(loc, fresh.location);
  }

  stdout.write("adhanline — doctor\n\nLocation\n");
  line("city", loc.city ?? "(unset)");
  line("country", loc.country ?? "(unset)");
  line("timezone", loc.timezone ?? "(unset)");
  line(
    "coordinates",
    loc.latitude != null && loc.longitude != null
      ? `${loc.latitude}, ${loc.longitude}`
      : "(unset)",
  );
  line("source", loc.source);
  line("confirmed", loc.confirmed ? "yes" : "no");

  stdout.write("\nPaths\n");
  line("config", configFile());
  line("cache", cacheDir());
  line("method", config.calculation.method);

  stdout.write("\nToday's prayer times\n");
  if (isComputable(loc)) {
    try {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: loc.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      for (const p of getPrayerDay(
        loc,
        config.calculation.method,
        date,
        config.display.showSeconds,
      ).prayers) {
        line(PRAYER_LABELS[p.name], p.clock);
      }
    } catch (err) {
      line("error", err instanceof Error ? err.message : String(err));
    }
  } else {
    line("status", "location incomplete — cannot compute");
  }

  stdout.write("\nCache freshness\n");
  const locCache = readCache<LocationData>(LOCATION_FILE);
  line(
    "location.json",
    locCache
      ? `${isStale(locCache, LOCATION_TTL_MS) ? "stale" : "fresh"} (${locCache.savedAt})`
      : "(absent)",
  );
  const meta = readCache<CacheMeta>(META_FILE)?.data;
  line("last detect", meta?.lastDetect ?? "(never)");
  line("provider", meta?.provider ?? "(none)");
  line(
    "drift pending",
    meta?.locationDriftPending ? "YES — re-run `config` to re-confirm" : "no",
  );

  stdout.write("\nClaude Code\n");
  const version = detectClaudeVersion();
  line("version", version ? version.join(".") : "(undetected)");
  line(
    "refreshInterval",
    supportsRefreshInterval(version)
      ? "supported"
      : "not supported (events only)",
  );
  stdout.write("\n");
}
