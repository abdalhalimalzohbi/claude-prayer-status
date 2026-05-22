<div align="center">

# 🕌 adhanline

### A live Islamic prayer status line for Claude Code

Calm-to-urgent prayer strip · rotating dhikr · local prayer-time calculation — right inside your editor.

[![CI](https://github.com/abdalhalimalzohbi/adhanline/actions/workflows/ci.yml/badge.svg)](https://github.com/abdalhalimalzohbi/adhanline/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/adhanline.svg)](https://www.npmjs.com/package/adhanline)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey.svg)](#requirements)
[![made for Claude Code](https://img.shields.io/badge/made%20for-Claude%20Code-da7756.svg)](https://claude.com/claude-code)

</div>

```
🌇 9 Dhul-Hijjah 1447 │ Fajr 04:14 ✓ │ Dhuhr 11:54 ✓ │ Asr 15:21 ✓ │ Maghrib 18:09 (33m) │ Isha 19:25
📍 Bekasi
```

`adhanline` renders two lines at the bottom of your Claude Code session — a
prayer strip that tracks the day and a living line that rotates between your location
and Arabic dhikr. Prayer times are calculated **locally** from your coordinates, so the
status line does **zero network calls** on a warm cache and **never crashes** into your
terminal.

---

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Anatomy of the status line](#anatomy-of-the-status-line)
- [Theme gallery](#theme-gallery)
- [Commands](#commands)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Notes & limitations](#notes--limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🕰️ Prayer strip
- All five prayers — Fajr, Dhuhr, Asr, Maghrib, Isha — with the Hijri date
- Passed prayers dimmed with a `✓`; the next prayer highlighted with a **live countdown**
- A **sun-aware leading icon** that tracks the time of day
- Correct **midnight rollover** — after Isha the countdown spans into tomorrow's Fajr

### 🟢 Progressive urgency
- **Calm → Amber → NOW** — the next prayer escalates as it approaches
- A red `🔴 NOW` badge when the prayer time arrives
- Degrades to plain-text markers when color is unavailable (`NO_COLOR`, no-color terminals)

### 📿 Living line
- Shows your location at rest
- Surfaces a **rotating Arabic dhikr** roughly every 10 minutes
- A `✓ just now` **grace message** just after each prayer, with optional passive tasbih

### 🛡️ Built to never get in your way
- Universal error boundary — any failure resolves to a safe fallback, never a stack trace
- Sub-100 ms warm renders, zero network on the hot path
- Atomic file caching shared across every Claude Code session
- Timezone- and DST-correct; works regardless of the host clock

### 🎨 Configurable, with opinionated defaults
- Three themes — `minimal`, `neon`, `powerline`
- Adaptive collapse on narrow terminals
- Every visible behavior is overridable; works with zero config

---

## Installation

### npm (recommended)

```sh
npm install -g adhanline
adhanline install
```

`install` merges the status line into Claude Code's `settings.json` (backing up the
original) and walks you through confirming your location. Restart Claude Code — done.

### One-line script

```sh
curl -fsSL https://raw.githubusercontent.com/abdalhalimalzohbi/adhanline/main/install.sh | sh
```

### Manual

```sh
git clone https://github.com/abdalhalimalzohbi/adhanline.git
cd adhanline
npm install && npm run build
npm link
adhanline install
```

### Project-level install

```sh
adhanline install --project   # writes ./.claude/settings.json
```

---

## Anatomy of the status line

```
🌇  9 Dhul-Hijjah 1447 │ Fajr 04:14 ✓ │ … │ Maghrib 18:09 (33m) │ Isha 19:25
│   │                    │              │
│   │                    │              └─ upcoming prayer (normal)
│   │                    └──────────────── passed prayer (dimmed + ✓)
│   └───────────────────────────────────── Hijri date
└───────────────────────────────────────── sun-aware icon for the next prayer

📍 Bekasi
└─ living line: location · rotating dhikr · "✓ just now" after a prayer
```

| Next prayer styling | Meaning |
|---|---|
| `Maghrib 18:09 (33m)` | **Calm** — more than `amberMinutes` away |
| `Maghrib 18:09 (12m)` *(amber)* | **Amber** — within `amberMinutes` |
| `🔴 Maghrib NOW` *(red)* | **NOW** — the prayer time has arrived |

---

## Theme gallery

Set with `adhanline config set display.theme <name>` or preview with
`test --theme <name>`.

**minimal** — the calm default: dimmed history, a quiet bold highlight.

```
🌇 9 Dhul-Hijjah 1447 │ Fajr 04:14 ✓ │ Dhuhr 11:54 ✓ │ Maghrib 18:09 (33m) │ Isha 19:25
```

**neon** — vivid, high-contrast greens, magentas, and cyans.

**powerline** — segmented status-bar look; the next prayer sits in a filled block.

> Themes are pure ANSI and honor `NO_COLOR` and non-color terminals automatically.

---

## Commands

| Command | What it does |
|---|---|
| *(none)* | Render the status line. Reads stdin, never throws. |
| `install [--project]` | Wire into `settings.json`; `--project` targets `./.claude`. |
| `config [get\|set <key> [value]]` | Interactive editor, or scriptable get/set. |
| `doctor` | Diagnostics: location, paths, prayer times, cache, Claude Code version. |
| `test [--at HH:MM] [--date YYYY-MM-DD] [--theme NAME]` | Preview the render at any time. |
| `tasbih` | Interactive tasbih counter (33 → 33 → 34, then the closing dua). |
| `tmux` | Single-line render for a tmux status segment. |

```sh
adhanline test --at 18:05 --theme neon
adhanline doctor
```

---

## Configuration

Config lives at `~/.config/adhanline/config.json` (XDG-aware;
`%APPDATA%` on Windows). Everything works with zero config.

| Key | Default | Notes |
|---|---|---|
| `location.*` | auto | Set via `install` / `config`, or IP-detected. |
| `calculation.method` | `MuslimWorldLeague` | Any standard method — see `config`. |
| `display.theme` | `minimal` | `minimal` · `neon` · `powerline` |
| `display.countdownFormat` | `paren` | `(33m)` · `in 33m` · `33m` |
| `display.divider` | `pipe` | `pipe` · `dot` · `space` |
| `display.showHijri` | `true` | Hijri date prefix on line 1. |
| `display.checkmark` | `true` | `✓` on passed prayers. |
| `display.adaptiveWidth` | `true` | Collapse on narrow terminals. |
| `display.showSeconds` | `false` | `HH:mm:ss` instead of `HH:mm`. |
| `display.passiveTasbih` | `false` | Walk post-prayer adhkar during the grace window. |
| `urgency.amberMinutes` | `15` | Amber-tier threshold. |
| `urgency.nowGraceMinutes` | `25` | Post-prayer grace-window length. |
| `dhikr.enabled` | `true` | Rotating dhikr on line 2. |
| `dhikr.intervalMinutes` | `10` | How often a dhikr window opens. |
| `dhikr.windowSeconds` | `90` | How long the window stays open. |
| `dhikr.rotation` | `sequential` | `sequential` · `random` |

```sh
adhanline config                          # interactive editor
adhanline config set display.theme neon   # scriptable
adhanline config get calculation.method
```

---

## How it works

```
IP geolocation (first run / weekly)
        └─▶ coordinates ──▶ local prayer calculation (daily) ──▶ cache ──▶ render (every refresh)
```

- **Location** is detected once by IP, **confirmed by you** (guarding against VPN
  mislocation), and refreshed at most weekly.
- **Prayer times** are computed locally each day from your coordinates — the render
  path performs no network I/O on a warm cache.
- The entire hot path runs inside an error boundary: any failure prints a safe
  fallback line and exits cleanly.

---

## Requirements

- **Node.js >= 18**
- **Claude Code** — `refreshInterval` (timer-based redraw) needs Claude Code >= 2.1.97;
  on older versions the line still updates on events. `install` handles this for you.
- **OS** — macOS, Linux, Windows.

---

## Notes & limitations

- **Prayer times are calculated, not authoritative.** Different methods yield different
  times — verify against a trusted local source.
- **No push notifications.** A pull-based status line cannot fire an alert when no one
  is looking; the in-line urgency + `NOW` state is the realistic version.
- **~60 s timing granularity.** Time windows are sized accordingly.
- **IP geolocation is approximate.** On a VPN, set your location manually.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm test`
before opening a PR; the suite runs on Node 18 / 20 / 22 across all three platforms.

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## License

[MIT](LICENSE) © adhanline contributors

<div align="center">
<sub>Times are computed locally and may differ from your local authority. Verify when in doubt.</sub>
</div>
