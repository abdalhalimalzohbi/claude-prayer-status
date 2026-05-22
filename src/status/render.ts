// Two-line status render — composition root.
import type { DateTime } from "luxon";
import type { Config } from "../types.js";
import { isComputable } from "../prayer/calculate.js";
import { reshapeArabic } from "../util/arabic.js";
import { buildLine1 } from "./line1-prayers.js";
import { buildLine2 } from "./line2-living.js";
import { buildState } from "./state.js";
import { resolveTheme } from "./theme.js";
import { classifyUrgency } from "./urgency.js";

export const CONFIG_NUDGE = "🕌 run: claude-prayer-status config";

// `reshape` pre-shapes Arabic into connected presentation forms — needed for
// the Claude Code status line, which doesn't shape Arabic itself. Plain
// terminals shape natively, so the `test` command leaves it off.
export function renderStatus(
  config: Config,
  now?: DateTime,
  reshape = false,
): string {
  if (!isComputable(config.location)) return CONFIG_NUDGE;

  const state = buildState(config, now);
  const theme = resolveTheme(config.display.theme);
  const tier = classifyUrgency(state);
  const out = `${buildLine1(state, theme, tier)}\n${buildLine2(state, theme, tier)}`;
  return reshape ? reshapeArabic(out) : out;
}
