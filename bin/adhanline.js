#!/usr/bin/env node
/**
 * Thin executable entry. Defers everything to the compiled router so the
 * shebang file itself stays trivial and stable.
 */
import { main } from "../dist/index.js";

main(process.argv.slice(2)).catch(() => {
  // Last-resort guard: the hot path has its own boundary, but never let an
  // unexpected rejection surface a stack trace into the status line.
  process.exitCode = 0;
});
