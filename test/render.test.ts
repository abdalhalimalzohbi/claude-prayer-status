import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/config/schema.js";
import { DHIKR_LIST } from "../src/dhikr/list.js";
import { CONFIG_NUDGE, renderStatus } from "../src/status/render.js";
import { reshapeArabic } from "../src/util/arabic.js";
import { JAKARTA, at } from "./helpers.js";

const config = normalizeConfig({ location: JAKARTA, dhikr: { enabled: false } });

function lines(now: ReturnType<typeof at>): [string, string] {
  const [l1, l2] = renderStatus(config, now).split("\n");
  return [l1!, l2!];
}

describe("renderStatus", () => {
  it("nudges when no location is configured", () => {
    expect(renderStatus(normalizeConfig({}))).toBe(CONFIG_NUDGE);
  });

  it("renders two lines with all five prayers", () => {
    // 13:30 — outside any grace/dhikr window, so line 2 rests on location.
    const [l1, l2] = lines(at("2026-05-22", "13:30"));
    for (const name of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      expect(l1).toContain(name);
    }
    expect(l2).toContain("Bekasi");
  });

  it("shows a countdown on the calm next prayer", () => {
    const [l1] = lines(at("2026-05-22", "12:00"));
    expect(l1).toMatch(/Asr 15:11 \(\d/);
  });

  it("escalates to an amber marker near the next prayer", () => {
    const [l1] = lines(at("2026-05-22", "17:40"));
    expect(l1).toContain("Maghrib 17:43 !");
  });

  it("shows the NOW badge at the prayer minute", () => {
    const [l1] = lines(at("2026-05-22", "17:43"));
    expect(l1).toContain("Maghrib NOW");
  });

  it("rolls the strip over to tomorrow's Fajr after Isha", () => {
    const [l1] = lines(at("2026-05-22", "23:30"));
    expect(l1).toMatch(/Fajr 04:\d\d \(/);
    expect(l1).toContain("Isha 18:52 ✓");
  });

  it("collapses on a narrow terminal", () => {
    const prev = process.env.COLUMNS;
    process.env.COLUMNS = "40";
    try {
      const [l1] = lines(at("2026-05-22", "12:00"));
      expect(l1).toContain("Asr 15:11");
      expect(l1).not.toContain("Fajr");
    } finally {
      if (prev === undefined) delete process.env.COLUMNS;
      else process.env.COLUMNS = prev;
    }
  });
});

describe("line 2 priority", () => {
  it("shows the grace message just after a prayer", () => {
    const cfg = normalizeConfig({ location: JAKARTA });
    const [, l2] = renderStatus(cfg, at("2026-05-22", "17:50")).split("\n");
    expect(l2).toContain("just now");
  });

  it("surfaces a dhikr inside a dhikr window", () => {
    const cfg = normalizeConfig({ location: JAKARTA });
    const [, l2] = renderStatus(cfg, at("2026-05-22", "13:10")).split("\n");
    expect(DHIKR_LIST.some((d) => l2!.includes(reshapeArabic(d)))).toBe(true);
  });
});
