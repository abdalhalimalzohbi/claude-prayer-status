// CLI subcommand router — manual arg parsing, lazy-loaded off the hot path.
import { runConfig } from "../config/command.js";
import { runDoctor } from "./doctor.js";
import { runInstall } from "./install.js";
import { runTasbih } from "./tasbih.js";
import { runTest } from "./test.js";
import { runTmux } from "./tmux.js";

const VERSION = "0.1.0";

const HELP = `adhanline — a live Islamic prayer status line for Claude Code

Usage:
  adhanline                  render the status line (reads stdin)
  adhanline install [--project]
  adhanline doctor
  adhanline test [--at HH:MM] [--date YYYY-MM-DD] [--theme NAME]
  adhanline config [get|set <key> [value]]
  adhanline tasbih
  adhanline tmux
  adhanline --version
`;

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = "true";
    }
  }
  return flags;
}

export async function runCli(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "install":
      await runInstall({ project: rest.includes("--project") });
      return;
    case "doctor":
      await runDoctor();
      return;
    case "test": {
      const f = parseFlags(rest);
      runTest({ at: f.at, date: f.date, theme: f.theme });
      return;
    }
    case "config":
      await runConfig(rest);
      return;
    case "tasbih":
      await runTasbih();
      return;
    case "tmux":
      runTmux();
      return;
    case "--version":
    case "-v":
      process.stdout.write(`${VERSION}\n`);
      return;
    default:
      process.stdout.write(HELP);
      if (cmd && !["help", "--help", "-h"].includes(cmd)) {
        process.exitCode = 1;
      }
  }
}
