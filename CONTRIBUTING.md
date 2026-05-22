# Contributing

Thanks for your interest in improving **adhanline**. Contributions of
all sizes are welcome — bug reports, fixes, themes, and docs.

## Development setup

```sh
git clone https://github.com/abdalhalimalzohbi/adhanline.git
cd adhanline
npm install
npm run build
npm test
```

Requires Node.js >= 18.

## Workflow

```sh
npm run dev     # tsc --watch
npm test        # run the vitest suite
npm run build   # compile to dist/
```

Preview the status line without waiting for the clock:

```sh
node bin/adhanline.js test --at 17:40 --theme neon
```

## Guidelines

- **The hot path is sacred.** The default render must stay fast and must never
  throw — keep network code and heavy dependencies off it.
- **Correctness over cleverness for prayer times.** Prefer `adhan` + `luxon`
  over hand-rolled math; all time logic goes through IANA timezones.
- **Add a test** for any behavior change. The suite must stay green on Node
  18 / 20 / 22 across macOS, Linux, and Windows (see `.github/workflows/ci.yml`).
- **Keep it lightweight.** New runtime dependencies need a strong justification.
- Match the surrounding code style — small, comment-light, no duplication.

## Pull requests

1. Fork and branch from `main`.
2. Make your change with tests and a green `npm test`.
3. Add a `CHANGELOG.md` entry under an `Unreleased` heading.
4. Open the PR with a clear description of the what and why.

## Reporting bugs

Open an issue with the output of `adhanline doctor`, your OS, and
your Claude Code version.

By contributing you agree your work is licensed under the project's
[MIT License](LICENSE).
