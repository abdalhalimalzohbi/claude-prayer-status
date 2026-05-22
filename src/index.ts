// Entrypoint: no args → the status-line hot path; any args → CLI subcommands.
// Subcommand code loads behind a dynamic import so the hot path never pays
// for it (no commander, no readline on the render path).
import { loadConfig } from "./config/load.js";
import { renderStatus } from "./status/render.js";
import { runSafely } from "./util/safe.js";
import { parseSession, readStdin } from "./util/stdin.js";

export async function main(argv: string[]): Promise<void> {
  if (argv.length > 0) {
    const { runCli } = await import("./cli/index.js");
    await runCli(argv);
    return;
  }

  await runSafely(async () => {
    parseSession(await readStdin()); // tolerated; consumed in later phases
    // reshape = true: the status line doesn't shape Arabic itself.
    return renderStatus(loadConfig(), undefined, true);
  });
}
