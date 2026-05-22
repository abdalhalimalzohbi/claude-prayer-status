// Line 2: one state by priority — grace window, then dhikr window, then
// the resting location line.
import type { UrgencyTier } from "../types.js";
import { POST_PRAYER_TASBIH } from "../dhikr/list.js";
import { dhikrWindow } from "../dhikr/window.js";
import { paint } from "../util/color.js";
import { PRAYER_LABELS } from "./line1-prayers.js";
import type { RenderState } from "./state.js";
import type { Theme } from "./theme.js";

function graceText(state: RenderState): string {
  const passed = state.next.lastPassed!;
  const label = PRAYER_LABELS[passed.name];
  if (!state.config.display.passiveTasbih) return `${label} ✓ · just now`;

  // Walk the post-prayer adhkar across the grace window.
  const span = state.config.urgency.nowGraceMinutes / POST_PRAYER_TASBIH.length;
  const idx = Math.min(
    POST_PRAYER_TASBIH.length - 1,
    Math.floor(passed.minutesAgo / Math.max(1, span)),
  );
  return `${label} ✓ · ${POST_PRAYER_TASBIH[idx]}`;
}

export function buildLine2(state: RenderState, theme: Theme, tier: UrgencyTier): string {
  const { config, next, now } = state;

  const grace = next.lastPassed;
  if (grace && grace.minutesAgo >= 0 && grace.minutesAgo <= config.urgency.nowGraceMinutes) {
    return paint(theme.grace, graceText(state));
  }

  const suppressed = config.dhikr.suppressWhenImminent && tier !== "calm";
  if (config.dhikr.enabled && !suppressed) {
    const dhikr = dhikrWindow(now, config.dhikr);
    if (dhikr) return paint(theme.dhikr, dhikr);
  }

  return paint(theme.location, `📍 ${config.location.city ?? "location unknown"}`);
}
