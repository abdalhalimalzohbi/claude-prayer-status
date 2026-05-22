# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-22

Initial release.

### Added

- **Prayer strip (line 1):** Hijri date, all five prayers, passed prayers
  dimmed with a `✓`, the next prayer highlighted with a live countdown, and a
  sun-aware leading icon.
- **Living line (line 2):** location by default, a rotating Arabic dhikr every
  ~10 minutes, and a `✓ just now` grace message after each prayer.
- **Progressive urgency:** calm → amber → a red `NOW` badge as the next prayer
  approaches; degrades to text markers without color.
- **Local prayer calculation** via `adhan` + `luxon` — timezone-correct,
  DST-safe, with correct midnight rollover to tomorrow's Fajr.
- **IP location detection** (ip-api → ipinfo → ipapi) with first-run
  confirmation and weekly travel-drift detection.
- **Themes:** `minimal`, `neon`, `powerline`; adaptive collapse on narrow
  terminals.
- **Commands:** `install`, `config`, `doctor`, `test`, `tasbih`, `tmux`.
- **Reliability:** universal error boundary (never crashes the terminal),
  tolerant stdin parsing, atomic file caching, sub-100 ms warm renders.

[0.1.0]: https://github.com/abdalhalimalzohbi/adhanline/releases/tag/v0.1.0
