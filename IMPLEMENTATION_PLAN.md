# adhanline — Implementation Plan

> An open-source, cross-platform CLI that renders a live Islamic prayer status line inside Claude Code. Built as an npm package. Auto-detects location, calculates prayer times locally, and displays a calm-to-urgent prayer strip with a rotating dhikr line.

This document is the build spec. It is written to be handed directly to Claude Code. Implement phases in order; each phase is independently shippable.

---

## 1. Product summary

A `command`-type Claude Code status line that prints two lines:

```
🌇 9 Ra\jab 1447 │ Fajr 04:14 ✓ │ Dhuhr 11:54 ✓ │ Asr 15:21 ✓ │ Maghrib 18:09 (33m) │ Isha 19:25
📍 Bekasi
```

- **Line 1 — prayer strip (always):** Hijri date, all five prayers, passed prayers dimmed with a `✓`, the next prayer highlighted with a live countdown, leading icon that tracks the time of day, and urgency styling that escalates as the next prayer approaches.
- **Line 2 — living line (rotates):** shows location by default; surfaces a rotating Arabic dhikr roughly every 10 minutes; shows a post-prayer grace message just after each prayer time.

The tool calculates prayer times **locally** from coordinates (no per-refresh network calls), caches aggressively, and must **never crash into the user's terminal** — every failure resolves to a safe fallback string.

### Non-negotiable design principles

1. **The hot path is sacred.** The status-line render must be fast (target sub-100ms cold start) and must never throw. Network, heavy deps, and anything fallible are kept off the default render path.
2. **Pull-based, stateless.** Claude Code re-runs the command on events and on a timer. There is no daemon and no in-memory state between runs. All "memory" is file-based cache. All time-window behavior (dhikr, grace, urgency) is computed purely from the current clock on each render.
3. **Correctness over cleverness for prayer times.** A wrong city means wrong prayer times, which is worse than a normal app being slightly off. Location is confirmed, not silently trusted.
4. **Cross-platform.** macOS, Linux, Windows. No shell-specific assumptions in the hot path.
5. **Configurable, with sensible opinionated defaults.** Works with zero config; every visible behavior is overridable.

---

## 2. Claude Code status line integration (verified mechanics)

These mechanics are confirmed against current Claude Code docs and must be respected:

- Config lives in `settings.json` (user-level `~/.claude/settings.json` or project `.claude/settings.json`):

  ```json
  {
    "statusLine": {
      "type": "command",
      "command": "adhanline",
      "padding": 0,
      "refreshInterval": 60
    }
  }
  ```

- The command **receives a JSON object on stdin** containing session data. The hot path must read and parse stdin (tolerating empty/invalid stdin), and may use fields from it (e.g. a session identifier) for multi-instance behavior.
- The command **prints to stdout**. Multi-line output is supported — emit line 1 and line 2 separated by `\n`.
- Updates are **event-driven** (after each assistant message, on `/compact`, on permission-mode change, on vim-mode toggle), **debounced at 300ms**, and an in-flight run is cancelled if a new update arrives. Event triggers go quiet when the session is idle.
- `refreshInterval` (integer seconds, minimum 1) re-runs the command on a fixed timer **in addition** to events. **It requires Claude Code >= 2.1.97**; older versions silently ignore it (the line would then only update on events). The installer must handle this gracefully (see §9).

**Implication for time-based features:** because the minimum reliable redraw cadence is ~60s (the `refreshInterval`), any time window (dhikr, grace, NOW state) must be **at least ~60s wide** to be reliably visible, and the design must tolerate the line refreshing more often during active chat.

---

## 3. Architecture

```
stdin (Claude Code session JSON)
        │
        ▼
┌─────────────────────────────────────────────┐
│ HOT PATH (default invocation, no subcommand) │
│  1. read+parse stdin (tolerant)              │
│  2. load config (sync file read)             │
│  3. load cache (sync file read)              │
│  4. if cache stale → recompute locally       │
│     (prayer times from cached coordinates)   │
│  5. render two lines                         │
│  6. print to stdout                          │
│  ── wrapped so ANY error → safe fallback ──  │
└─────────────────────────────────────────────┘
        │ (network only happens here, lazily, when cache is cold)
        ▼
  Location resolution: IP geolocation chain → coordinates → cache
  Prayer calc: adhan-js (coordinates + method + madhab) → today's times → cache
```

### Data flow

```
IP Geolocation (first run / weekly) → Coordinates → Local Prayer Calculation (daily) → Cached → Rendered (every refresh)
```

- **Location** is resolved at most weekly (and on explicit `config`/travel re-confirm). Cached.
- **Prayer times** are computed locally per day from cached coordinates. Cached per date.
- **The render path does no network I/O** when caches are warm — which is the overwhelmingly common case.

---

## 4. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript | Strict mode. Compiled to JS for distribution. |
| Runtime | Node.js >= 18 | Use built-in `Intl` for Hijri (no extra dep). |
| Prayer math | `adhan` (adhan-js) | Calculation methods + madhab (Asr) handling. |
| Time/timezone | `luxon` | DST-safe, explicit zones, no ambient local-time bugs. |
| CLI framework | `commander` | **Lazy-loaded** — only for subcommands, never the hot path. |
| Colors | `chalk` | Used in render; respects `NO_COLOR` and non-TTY. |
| HTTP | native `fetch` (Node 18+) | No axios. Short timeouts. Only on cold cache. |

**Hot-path dependency rule:** the default render must import only what it needs (luxon, adhan, chalk, and small internal modules). `commander` and any subcommand-only code must be dynamically `import()`-ed inside the subcommand handlers so they never load on the status-line path.

---

## 5. Project structure

```
adhanline/
├── bin/
│   └── adhanline.js      # thin entry; routes to hot path or subcommands
├── src/
│   ├── index.ts                     # entrypoint: detect subcommand vs status render
│   ├── status/
│   │   ├── render.ts                # builds line 1 + line 2 from state
│   │   ├── line1-prayers.ts         # prayer strip: order, dim/✓, highlight, countdown
│   │   ├── line2-living.ts          # location | dhikr | grace selection + render
│   │   ├── urgency.ts               # urgency tier from minutes-to-next
│   │   ├── icons.ts                 # sun-aware leading icon
│   │   └── theme/
│   │       ├── index.ts             # theme registry + resolver
│   │       ├── minimal.ts
│   │       ├── neon.ts
│   │       └── powerline.ts
│   ├── prayer/
│   │   ├── calculate.ts             # adhan-js wrapper → today's PrayerTimes
│   │   ├── method.ts                # calc-method + madhab resolution, region defaults
│   │   ├── next-prayer.ts           # which prayer is next, minutes remaining, NOW logic
│   │   └── hijri.ts                 # Intl islamic-umalqura date string
│   ├── location/
│   │   ├── detect.ts                # provider fallback chain
│   │   ├── providers.ts             # ip-api, ipinfo, ipapi adapters
│   │   ├── confirm.ts               # first-run city confirmation prompt
│   │   └── travel.ts                # detect large IP/location drift
│   ├── dhikr/
│   │   ├── list.ts                  # the dhikr set (Arabic)
│   │   └── window.ts                # is-now-a-dhikr-window? + selection
│   ├── config/
│   │   ├── schema.ts                # config type + validation + defaults
│   │   ├── paths.ts                 # XDG-compliant config/cache paths (cross-platform)
│   │   ├── load.ts                  # tolerant sync loader w/ defaults merge
│   │   └── command.ts               # `config` interactive editor
│   ├── cache/
│   │   ├── store.ts                 # atomic read/write JSON, staleness checks
│   │   └── keys.ts                  # cache key/ttl definitions
│   ├── cli/
│   │   ├── doctor.ts                # diagnostics
│   │   ├── test.ts                  # preview render at arbitrary time (--at)
│   │   ├── install.ts               # writes statusLine into settings.json
│   │   ├── qibla.ts                 # qibla bearing from coords
│   │   └── tasbih.ts                # interactive tasbih TUI (later phase)
│   ├── modes/
│   │   └── ramadan.ts               # Suhoor/Iftar reframing when Hijri month = Ramadan
│   ├── util/
│   │   ├── safe.ts                  # top-level error boundary → fallback string
│   │   ├── stdin.ts                 # tolerant stdin JSON reader
│   │   ├── time.ts                  # countdown formatting (33m / 2h 14m)
│   │   └── width.ts                 # terminal width detection (adaptive density)
│   └── types.ts
├── test/                            # unit tests (see §11)
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                          # MIT
└── install.sh                       # optional convenience installer
```

---

## 6. Configuration

### 6.1 File locations (XDG, cross-platform)

Respect `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` with correct per-OS fallbacks:

- **Config:** `${XDG_CONFIG_HOME:-~/.config}/adhanline/config.json`
- **Cache:** `${XDG_CACHE_HOME:-~/.cache}/adhanline/`
- **Windows:** use `%APPDATA%` (config) and `%LOCALAPPDATA%` (cache). Implement in `config/paths.ts`; do not hardcode `~/`.

> The original idea of a single `~/.adhanline.json` dotfile is replaced by the XDG split (config vs cache) since the feature set carries real state (themes, cache, mode). Provide a one-time migration if a legacy dotfile is found.

### 6.2 Config schema (with defaults)

```jsonc
{
  "version": 1,
  "location": {
    "source": "auto",            // "auto" | "manual"
    "city": null,                // string when known/confirmed
    "country": null,
    "timezone": null,            // IANA, e.g. "Asia/Beirut"
    "latitude": null,
    "longitude": null,
    "confirmed": false           // true once user confirms detected city
  },
  "calculation": {
    "method": "auto",            // "auto" picks by region; or an adhan method name
    "madhab": "shafi"            // "shafi" (standard) | "hanafi" (affects Asr)
  },
  "display": {
    "theme": "minimal",          // "minimal" | "neon" | "powerline"
    "language": "en",            // prayer NAME language; v1 = "en" only (structure ready for more)
    "showHijri": true,
    "showSeconds": false,
    "countdownFormat": "paren",  // "paren" => (33m) ; "in" => in 33m ; "bare" => 33m
    "divider": "pipe",           // "pipe" │ | "dot" · | "space"
    "checkmark": true,           // ✓ on passed prayers
    "adaptiveWidth": true        // collapse on narrow terminals
  },
  "urgency": {
    "amberMinutes": 15,          // <= this many minutes → amber
    "nowGraceMinutes": 25        // post-prayer "just now" grace window length
  },
  "dhikr": {
    "enabled": true,
    "intervalMinutes": 10,       // surface every N minutes
    "windowSeconds": 90,         // how long the window stays "open"
    "rotation": "sequential",    // "sequential" | "random"
    "suppressWhenImminent": true // no dhikr when next prayer <= amberMinutes away
  },
  "ramadan": {
    "mode": "auto"               // "auto" (detect via Hijri) | "on" | "off"
  }
}
```

`config/load.ts` must deep-merge user config over defaults and tolerate a missing/corrupt file (fall back to defaults, never throw on the hot path).

### 6.3 `config` command

`adhanline config` opens an interactive editor (prompts) to set: city/timezone (manual override), calculation method, madhab, theme, dhikr toggle/interval, ramadan mode. Writes atomically. Non-interactive form: `config set <key> <value>` and `config get <key>` for scripting.

---

## 7. Behavior specifications

### 7.1 Line 1 — prayer strip

Order: always Fajr → Dhuhr → Asr → Maghrib → Isha, preceded by the Hijri date (if `showHijri`) and a leading icon.

For each prayer, classify against current time:
- **Passed today:** dim/faint style + `✓` (if `checkmark`). This is the "done, high-opacity" look from the reference.
- **Next (the upcoming one):** highlighted (bold + color), with countdown appended per `countdownFormat`.
- **Upcoming (after next):** normal style, no countdown.

**Leading icon** (sun-aware, from `icons.ts`) reflects the current segment of day / next prayer: e.g. 🌅 Fajr, ☀️ Dhuhr, 🌤️ Asr, 🌇 Maghrib, 🌙 Isha.

**Countdown formatting** (`util/time.ts`): `< 60m` → `33m`; `>= 60m` → `2h 14m`. Wrapped per `countdownFormat`.

**Edge: after Isha / before Fajr.** "Next" rolls over to tomorrow's Fajr. Countdown spans midnight correctly (compute against tomorrow's Fajr datetime, not today's). All five may show as passed/✓ late at night, with Fajr (tomorrow) as next.

### 7.2 Urgency (progressive disclosure)

Compute minutes-to-next on every render and pick a tier (`urgency.ts`):

| Tier | Condition | Line 1 effect |
|---|---|---|
| Calm | `> amberMinutes` to next | Normal highlight on next prayer. |
| Amber | `<= amberMinutes` and `> 0` | Next prayer turns amber/orange; countdown emphasized. Dhikr suppressed (if configured). |
| NOW | within the prayer minute / grace start | Next prayer becomes **red + `NOW` badge**, e.g. `🔴 Maghrib NOW`. |

Color must degrade gracefully when colors are unavailable (NO_COLOR / non-TTY): fall back to text markers (`!`, `NOW`) so meaning survives without ANSI.

### 7.3 Line 2 — living line (priority order)

On each render, choose **one** state for line 2, highest priority first:

1. **Grace window** (highest): if a prayer time passed within the last `nowGraceMinutes`, show e.g. `Maghrib ✓ · just now`. (Optionally cycle a passive tasbih guide here — see §7.5.)
2. **Dhikr window:** if `dhikr.enabled`, not suppressed by imminence, and the current time falls in an open dhikr window (see §7.4), show the selected dhikr (Arabic only).
3. **Location (default/resting):** `📍 {city}`.

If `suppressWhenImminent` and urgency is Amber/NOW, skip dhikr (fall through to location, or keep grace if active).

### 7.4 Dhikr window logic (stateless)

No timer/state. Purely a function of the current clock:

- A window is "open" when `minuteOfDay % intervalMinutes == 0` extended for `windowSeconds` (i.e. open during `[boundary, boundary + windowSeconds)`). With `intervalMinutes: 10`, windows open at :00, :10, :20, …, each lasting `windowSeconds` (default 90s — must be ≥ 60s to survive the refresh cadence).
- **Selection:**
  - `sequential`: index = `(boundaryIndex) % dhikrList.length`, where `boundaryIndex = floor(minuteOfDay / intervalMinutes)`. Deterministic and rotates each window.
  - `random`: seed from the boundary timestamp so it's stable within a window (doesn't flicker between two refreshes inside the same window) but differs window-to-window.
- **List** (`dhikr/list.ts`, Arabic): سبحان الله · الحمد لله · الله أكبر · لا إله إلا الله · أستغفر الله · لا حول ولا قوة إلا بالله · اللهم صلِّ على محمد. Keep as a typed array so it's easy to extend.

### 7.5 Grace window + passive tasbih (Version A)

During the grace window, line 2 may optionally walk the post-prayer adhkar as a **non-interactive guide** (it does not count taps — the status line has no input): cycle `سبحان الله ٣٣` → `الحمد لله ٣٣` → `الله أكبر ٣٤` across the window using the same stateless boundary technique. Default behavior: simple `Name ✓ · just now`; passive tasbih is an opt-in display variant. (Interactive counting lives in the separate `tasbih` TUI — §10.)

### 7.6 Ramadan mode

When `ramadan.mode` resolves to active (auto: Hijri month == Ramadan), reframe the relevant prayers on line 1/line 2: emphasize **Suhoor ends (Fajr)** and **Iftar (Maghrib)**, e.g. `🌙 Iftar in 1h 12m`. Same underlying times — different labels/emphasis. Manual `on`/`off` overrides auto.

### 7.7 Adaptive width

If `adaptiveWidth` and the detected terminal is narrow (or width is unknown and a conservative threshold applies), collapse line 1 to next-prayer-only (`🌇 Maghrib 18:09 (33m)`) and drop the Hijri prefix. Use `COLUMNS`/tty width when available; degrade safely when unknown.

---

## 8. Location detection

### 8.1 Provider fallback chain (`location/providers.ts`, `detect.ts`)

Try in order, each with a short timeout (~2.5s), first success wins; record which provider answered:

1. **ip-api** (`http://ip-api.com/json/`) — no key; ~45 req/min free limit.
2. **ipinfo** (`https://ipinfo.io/json`) — generous free tier.
3. **ipapi** (`https://ipapi.co/json/`) — ~1000/day free.

Each adapter normalizes to `{ city, country, timezone, latitude, longitude }`. On total failure: use cached location; if none, prompt for manual entry (or show fallback string in non-interactive contexts).

> Network is only touched here, on cold/weekly cache — never on the warm hot path.

### 8.2 First-run confirmation (`location/confirm.ts`)

On first run (no confirmed location), detect via IP then **show the detected city and ask the user to confirm or correct it** before caching as `confirmed: true`. One prompt, then never again. This guards against VPN/corporate/mobile IPs placing the user in the wrong city (→ wrong prayer times).

Because the status-line hot path is non-interactive, first-run detection/confirmation is driven by `install`/`config`/`doctor` (interactive contexts). If the hot path runs with no confirmed location, it should: use any cached/auto location if present (rendering normally), else print a one-line nudge like `🕌 run: adhanline config` instead of guessing.

### 8.3 Travel detection (`location/travel.ts`)

On the weekly location refresh, if the freshly detected location differs significantly from the confirmed one (different city/country or large coordinate delta), do **not** silently switch. Mark a `locationDriftPending` flag in cache; surface a gentle prompt via `doctor`/`config` to re-confirm. The hot path keeps using the confirmed location until the user re-confirms.

---

## 9. Caching

`cache/store.ts` — JSON files under the cache dir, written **atomically** (write temp + rename) to survive concurrent multi-instance writes. Last-write-wins is acceptable.

| Cache item | Key/file | TTL / refresh |
|---|---|---|
| Location | `location.json` | Weekly (and on manual/travel re-confirm). |
| Prayer times | `prayers-<YYYY-MM-DD>-<lat,lng,method,madhab>.json` | Per day; recompute on date rollover or param change. |
| Timezone | stored with location | With location. |
| Provider/meta | `meta.json` | Which provider answered, last detect time, drift flag. |

**Multi-instance:** all Claude Code sessions share the same cache dir → one computation feeds every instance, no duplicate API calls. Use the stdin session id only to distinguish instances if/when needed; it is **not** required for correctness.

**Staleness check is cheap:** compare file mtime / embedded timestamp against TTL using sync reads. If stale and on an interactive/cold path, refresh; on the hot path, prefer serving slightly-stale cache over blocking, and refresh prayer times locally (no network) on date rollover.

---

## 10. CLI commands

| Command | Purpose |
|---|---|
| *(none)* | Hot path: read stdin, render two lines, print. Never throws. |
| `config` | Interactive settings editor; `config get/set <key> [value]` for scripting. |
| `doctor` | Diagnostics: detected location, config + cache paths, next 5 prayer times, cache freshness, Claude Code version, refreshInterval support, drift flag, and any problems. The thing users run when the line is blank. |
| `test [--at HH:MM] [--date YYYY-MM-DD] [--theme x]` | Render the line for an arbitrary time/date without waiting — for previewing urgency/dhikr/grace and tuning themes. |
| `install` | Write/merge the `statusLine` block into `settings.json` (see §9 version handling); run first-run location confirm. `--project` to target `.claude/settings.json`. |
| `qibla` | Print qibla bearing (degrees from North) from cached coordinates. |
| `tasbih` | Interactive tasbih TUI (later phase): full-screen counter, space increments, auto-advances 33→33→34, then a closing dua. Lives outside the status line; actually counts. |

### `install` — Claude Code version handling (smart & quiet)

1. Detect Claude Code version (e.g. parse `claude --version`).
2. If `>= 2.1.97`: write `statusLine` **with** `refreshInterval` (default 60).
3. If older or undetectable: write `statusLine` **without** `refreshInterval` (still works, updates on events only), and print one short, non-alarming note that timer-based refresh needs a newer Claude Code.
4. Merge into existing `settings.json` without clobbering unrelated keys (parse, set `statusLine`, write back atomically). Back up the original first.

---

## 11. Reliability requirements (must-haves)

- **Error boundary (`util/safe.ts`):** the entire hot path runs inside a try/catch. Any error → print a safe single fallback (`🕌 prayer times unavailable`) and exit 0. Never leak a stack trace into the status line.
- **stdin tolerance (`util/stdin.ts`):** read stdin fully but tolerate empty/missing/invalid JSON (Claude Code may call with or without data; tests will pipe nothing).
- **Timezone correctness:** all prayer math and "now" comparisons use the location's IANA timezone via Luxon — never the host's ambient local time. A user in Beirut on a server in another zone must still get Beirut times.
- **DST:** Luxon zone-aware datetimes; verify around spring-forward/fall-back (a prayer must not be skipped or duplicated; countdowns stay monotonic).
- **Midnight rollover:** correct "next prayer" after Isha → tomorrow's Fajr; date-keyed prayer cache recomputes on rollover.
- **Offline / API failure:** warm cache renders with zero network. Cold + offline → cached location if any, else the manual-config nudge. Never hang: all network has timeouts.
- **Madhab differences:** Asr time differs Hanafi vs Shafi'i; method affects Fajr/Isha angles. Resolution centralized in `prayer/method.ts`; `auto` picks a reasonable regional default but is always overridable.
- **Color safety:** honor `NO_COLOR` and non-TTY; meaning must survive without ANSI (text markers).
- **Performance:** target sub-100ms cold start on the hot path. Keep `commander` and subcommand code out of the hot path via dynamic import.

---

## 12. Testing

Unit tests (use a fast runner — `vitest` or node:test):

- **Prayer logic:** fixed coordinates + fixed clock → known next prayer, countdown, NOW state; midnight rollover; Hanafi vs Shafi Asr difference.
- **Urgency tiers:** boundary tests at `amberMinutes` and at the prayer minute.
- **Dhikr windows:** determinism within a window, rotation across windows, suppression when imminent, sequential vs seeded-random stability.
- **Grace window:** active within `nowGraceMinutes`, inactive after.
- **Timezone/DST:** render correctly for a zone different from the host; spring-forward and fall-back dates.
- **Config:** missing/corrupt config → defaults, no throw; deep-merge correctness.
- **Cache:** staleness boundaries; atomic write under simulated concurrency.
- **Error boundary:** inject a throw in render → fallback string, exit 0.
- **stdin:** empty / invalid / valid JSON all handled.
- **Location chain:** mock providers; first success wins; total failure → cached/manual path.

Provide `test --at` as a manual visual harness in addition to automated tests.

---

## 13. Distribution

- **Package name:** `adhanline` (verify availability on npm; pick a scoped name if taken).
- **`package.json`:** `bin` maps `adhanline` → `bin/adhanline.js`; `engines.node >= 18`; ship compiled JS (`dist/`) + types; `files` whitelist; `prepublishOnly` builds.
- **Install:** primary path `npm i -g adhanline`; also provide `install.sh` convenience (installs globally, runs `install` to wire up `settings.json` + first-run location confirm).
- **License:** MIT.
- **README:** quick start (3 commands), the two-line example, config reference, theme gallery, `doctor`/`test` usage, the honest note on notifications (see §15), and a fiqh/disclaimer note (times are computed; verify against local authority; methods/madhab are configurable).

---

## 14. Build phases (implement in this order)

**Phase 0 — Foundations (hard-to-retrofit spine).**
stdin contract + tolerant reader; XDG cross-platform paths; config schema + tolerant loader; cache store (atomic, staleness); prayer calc core (adhan + luxon, timezone/DST/rollover correct); the universal error boundary. Deliverable: a hot path that, given a cached location, prints a correct (if plain) prayer line and never crashes.

**Phase 1 — Shippable v1.**
Lean hot path with lazy subcommand loading; location detection chain + first-run confirmation + travel flag; line 1 prayer strip (dim/✓, highlight, countdown, sun-aware icon); line 2 location; one clean default theme (`minimal`); `config`, `doctor`, `test`, `install` commands; CC-version-aware install. Deliverable: `npm i -g` → working two-line status line matching the reference image.

**Phase 2 — Kitchen-sink UX.**
Progressive urgency tiers (calm/amber/NOW + red NOW badge); rotating Arabic dhikr on line 2 (stateless windows, suppression when imminent); grace window (`✓ just now`) + passive tasbih guide; Hijri (already wired) refinements; themes (`neon`, `powerline`); adaptive width; countdown/divider/checkmark options.

**Phase 3 — Advanced (file-cache-compatible only).**
Ramadan mode (Suhoor/Iftar reframing, auto via Hijri); multi-instance niceties via stdin session id; `qibla`; interactive `tasbih` TUI; tmux status segment reuse (same engine, alternate front-end). Document Eid/last-10-nights as optional extras.

---

## 15. Honest constraints to document (not bugs)

- **No true push notifications without a daemon.** A pull-based status line cannot fire a desktop notification when a prayer arrives if no one is looking at the terminal. This is deferred by design (no daemon in scope). The realistic in-scope version is the **urgency + NOW state in the line itself**. As an explicit, clearly-separate **opt-in**, an `install-reminders` command could register OS-native timers (launchd/systemd/Task Scheduler) independently of the status line — keep this out of the default flow and out of v1.
- **~60s timing granularity.** Time windows (dhikr, grace, NOW) are visible at refresh granularity, not frame-perfect. Windows are sized (≥60s) to account for this.
- **IP geolocation is approximate.** Confirmed-city + travel detection mitigate wrong-location risk; document that users on VPNs should set location manually.
- **Prayer times are calculated, not authoritative.** Different methods/madhabs yield different times; all are configurable. README should advise verifying against a trusted local source.

---

## 16. Acceptance criteria (definition of done for v1 = Phases 0–1)

1. `npm i -g adhanline && adhanline install` wires up Claude Code and confirms location interactively.
2. With a warm cache, the default invocation prints the two-line status (matching the reference layout) in well under 100ms and performs **zero** network calls.
3. Piping empty or malformed stdin still renders correctly.
4. Killing network access still renders from cache; with no cache, it shows a safe nudge — never a crash or stack trace.
5. Times are correct for the configured timezone regardless of host timezone; Asr respects madhab; next-prayer rolls over past midnight.
6. `doctor` reports location, paths, next 5 times, cache freshness, and CC `refreshInterval` support.
7. Works on macOS, Linux, and Windows paths (no `~/` hardcoding).
